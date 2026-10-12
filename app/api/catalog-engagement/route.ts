import { createHmac } from "node:crypto"
import { NextResponse } from "next/server"
import { cookieConsent } from "@/lib/browser-preferences"
import { isReadOnlyPreview } from "@/lib/preview-read-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BOT = /bot|crawl|spider|preview|headless|lighthouse|facebookexternalhit|slackbot|whatsapp|google-inspection/i
const hmac = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value).digest("hex")

type BrowserEvent = { listingId: string; kind: "impression" | "click"; position: number }
type Submitted = { pageId: string; events: BrowserEvent[] }
function validEvent(value: unknown): value is BrowserEvent {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return typeof item.listingId === "string" && UUID.test(item.listingId) &&
    (item.kind === "impression" || item.kind === "click") &&
    typeof item.position === "number" && Number.isInteger(item.position) &&
    item.position >= 1 && item.position <= 100
}

export async function POST(request: Request) {
  // Production-linked preview databases must never receive analytics test writes.
  if (isReadOnlyPreview() || process.env.VERCEL_ENV === "preview") {
    return NextResponse.json({ code: "preview_read_only" }, { status: 403 })
  }
  const origin = request.headers.get("origin")
  if (!origin || origin !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ code: "origin_mismatch" }, { status: 403 })
  }
  if (cookieConsent(request.headers.get("cookie"))?.analytics !== true) {
    return NextResponse.json({ counted: 0 }, { status: 200 })
  }
  const agent = request.headers.get("user-agent")?.slice(0, 300) ?? ""
  if (!agent || BOT.test(agent)) {
    return NextResponse.json({ counted: 0 }, { status: 200 })
  }
  let submitted: Submitted
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 8192) throw Error("large body")
    submitted = JSON.parse(await request.text()) as Submitted
  } catch {
    return NextResponse.json({ code: "invalid_payload" }, { status: 400 })
  }
  if (!submitted || !UUID.test(submitted.pageId ?? "") ||
    !Array.isArray(submitted.events) ||
    submitted.events.length < 1 || submitted.events.length > 20 ||
    !submitted.events.every(validEvent)) {
    return NextResponse.json({ code: "invalid_events" }, { status: 400 })
  }
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return NextResponse.json({ code: "measurement_unavailable" }, { status: 503 })

  // Trusted only when set/overwritten by Vercel. Never use user-supplied identity.
  const ip = process.env.VERCEL_ENV
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    : "127.0.0.1"
  if (!ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip)) {
    return NextResponse.json({ code: "network_unavailable" }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const ids = Array.from(new Set(submitted.events.map(item => item.listingId)))
    const [result, auth] = await Promise.all([
      supabase.from("listings").select("id,seller_id,status").in("id",ids),
      supabase.auth.getUser(),
    ])
    if (result.error) throw result.error
    const allowed = new Set((result.data ?? [])
      .filter(row => row.status === "active" && row.seller_id !== auth.data.user?.id)
      .map(row => row.id))
    const events = submitted.events.filter(event => allowed.has(event.listingId))
    if (!events.length) return NextResponse.json({ counted: 0 }, { status: 200 })

    const networkHash = hmac(secret, `catalog-network-v1:${ip}`)
    const pageHash = hmac(secret, `catalog-page-v1:${networkHash}:${submitted.pageId}`)
    const payload = events.map(event => ({
      listing_id: event.listingId,
      event_kind: event.kind,
      position: event.position,
      event_key: hmac(secret, `catalog-event-v1:${pageHash}:${event.listingId}:${event.kind}`),
    }))
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("record_catalog_engagement", {
      p_items: payload,
      p_page_hash: pageHash,
      p_network_hash: networkHash,
    })
    if (error) throw error
    return NextResponse.json({ counted: Number(data) || 0 }, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    console.warn("catalog_engagement_failed", error instanceof Error ? error.message : "unknown")
    return NextResponse.json({ code: "measurement_unavailable" }, { status: 503 })
  }
}
