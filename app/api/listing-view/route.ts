import { createHmac } from "node:crypto"
import { NextResponse } from "next/server"
import { cookieConsent } from "@/lib/browser-preferences"
import { isReadOnlyPreview } from "@/lib/preview-read-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOT_UA = /bot|crawl|spider|preview|headless|lighthouse|facebookexternalhit|slackbot|whatsapp|google-inspection/i

export async function POST(request: Request) {
  if (isReadOnlyPreview()) {
    return NextResponse.json({ code: "preview_read_only" }, { status: 403 })
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ code: "cross_site" }, { status: 403 })
  }
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin) {
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
  if (typeof body.listingId !== "string" || !UUID.test(body.listingId)) {
    return NextResponse.json({ code: "invalid_listing" }, { status: 400 })
  }

  // A missing trustworthy client network address is not a unique viewer.
  // Never let callers supply their own identity/deduplication token.
  const clientIp = (request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? ""
  if (!clientIp || clientIp.length > 64) {
    return NextResponse.json({ counted: false }, { status: 200 })
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
    const actor = authResponse.data.user?.id
      ? `user:${authResponse.data.user.id}`
      : `network:${clientIp}:ua:${userAgent}`
    const hash = createHmac("sha256", secret).update(`listing-view-v1:${actor}`).digest("hex")
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("record_distinct_listing_view", {
      p_listing_id: listing.id,
      p_viewer_hash: hash,
    })
    if (error) throw error
    return NextResponse.json({ counted: data === true }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.warn("listing_view_measurement_failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ code: "measurement_unavailable" }, { status: 503 })
  }
}
