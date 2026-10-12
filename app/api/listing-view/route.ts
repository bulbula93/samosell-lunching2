import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { cookieConsent } from "@/lib/browser-preferences"
import { isReadOnlyPreview } from "@/lib/preview-read-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOT_UA = /bot|crawl|spider|preview|headless|lighthouse|facebookexternalhit|slackbot|whatsapp|google-inspection/i
const VISITOR_COOKIE = "samosell_listing_viewer"
const VISITOR_AGE_SECONDS = 30 * 24 * 60 * 60

function sameOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false
  const origin = request.headers.get("origin")
  return Boolean(origin && origin === new URL(request.url).origin)
}

function visitorSignature(id: string, key: string) {
  return createHmac("sha256", key).update(`listing-view-cookie-v1:${id}`).digest("hex")
}

function signedVisitor(cookieHeader: string | null, key: string) {
  const raw = cookieHeader?.split(";").map(part => part.trim())
    .find(part => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1)
  if (!raw) return null
  const separator = raw.indexOf(".")
  if (separator < 0) return null
  const id = raw.slice(0, separator)
  const signature = raw.slice(separator + 1)
  if (!UUID.test(id) || !/^[0-9a-f]{64}$/.test(signature)) return null
  const actual = Buffer.from(signature, "hex")
  const expected = Buffer.from(visitorSignature(id, key), "hex")
  return timingSafeEqual(actual, expected) ? id : null
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ code: "origin_mismatch" }, { status: 403 })
  }
  const response = NextResponse.json({ cleared: true }, { headers: { "Cache-Control": "no-store" } })
  response.cookies.set(VISITOR_COOKIE, "", {
    path: "/api/listing-view",
    maxAge: 0,
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
  })
  return response
}

export async function POST(request: Request) {
  if (isReadOnlyPreview()) {
    return NextResponse.json({ code: "preview_read_only" }, { status: 403 })
  }
  if (!sameOrigin(request)) {
    return NextResponse.json({ code: "origin_mismatch" }, { status: 403 })
  }
  if (cookieConsent(request.headers.get("cookie"))?.analytics !== true) {
    return NextResponse.json({ counted: false }, { status: 200 })
  }
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? ""
  if (!userAgent || BOT_UA.test(userAgent)) {
    return NextResponse.json({ counted: false }, { status: 200 })
  }
  let body: { listingId?: unknown }
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 1024) throw Error("oversize")
    body = await request.json()
  } catch {
    return NextResponse.json({ code: "invalid_json" }, { status: 400 })
  }
  if (!body || typeof body.listingId !== "string" || !UUID.test(body.listingId)) {
    return NextResponse.json({ code: "invalid_listing" }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const [listingResponse, authResponse] = await Promise.all([
      supabase.from("listings").select("id, seller_id, status").eq("id", body.listingId).maybeSingle(),
      supabase.auth.getUser(),
    ])
    if (listingResponse.error) throw listingResponse.error
    const listing = listingResponse.data
    if (!listing || listing.status !== "active" || authResponse.data.user?.id === listing.seller_id) {
      return NextResponse.json({ counted: false }, { status: 200 })
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret) throw Error("listing view measurement unavailable")

    // Anonymous visitors have independent, server-signed first-party identifiers.
    // No raw IP or user-agent is persisted as a viewer identity.
    const previousVisitor = signedVisitor(request.headers.get("cookie"), secret)
    const visitor = previousVisitor ?? randomUUID()
    const actor = authResponse.data.user?.id
      ? `user:${authResponse.data.user.id}`
      : `browser:${visitor}`
    const hash = createHmac("sha256", secret).update(`listing-view-v1:${actor}`).digest("hex")

    const admin = createAdminClient()
    const { data, error } = await admin.rpc("record_distinct_listing_view", {
      p_listing_id: listing.id,
      p_viewer_hash: hash,
    })
    if (error) throw error
    const response = NextResponse.json({ counted: data === true }, {
      headers: { "Cache-Control": "no-store" },
    })
    if (!authResponse.data.user?.id || previousVisitor) {
      response.cookies.set(VISITOR_COOKIE, `${visitor}.${visitorSignature(visitor, secret)}`, {
        path: "/api/listing-view",
        maxAge: VISITOR_AGE_SECONDS,
        httpOnly: true,
        secure: new URL(request.url).protocol === "https:",
        sameSite: "lax",
      })
    }
    return response
  } catch (error) {
    console.warn("listing_view_measurement_failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ code: "measurement_unavailable" }, { status: 503 })
  }
}
