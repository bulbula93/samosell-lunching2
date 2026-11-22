import { isListingShareAction } from "@/lib/facebook-community"
import { after } from "next/server"
import { cookieConsent } from "@/lib/browser-preferences"
import { BoundedBodyError, readBoundedRequestBody } from "@/lib/bounded-request-body"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { growthWritesEnabled } from "@/lib/growth/server"
import { deliverMetaEvents } from "@/lib/growth/meta-server"
import { parseContext, safePath, routeGroup, sanitizePublishFailure, uuid } from "@/lib/growth/shared"

const headers = { "Cache-Control": "private, no-store" }
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "origin" }, { status: 403, headers })
  if (!growthWritesEnabled()) return Response.json({ enabled: false, conversions: [] }, { headers })
  let body: Record<string, unknown>
  try { body = JSON.parse(await readBoundedRequestBody(request, 4096)) } catch (error) { return Response.json({ error: "invalid_body" }, { status: error instanceof BoundedBodyError ? error.httpStatus : 400, headers }) }
  if (!body || typeof body !== "object") return Response.json({ error: "invalid_body" }, { status: 400, headers })
  const consent = cookieConsent(request.headers.get("cookie"))
  const hasAuth = /(?:^|;\s*)sb-[^=]+-auth-token/.test(request.headers.get("cookie") ?? "")
  const user = hasAuth ? (await (await createClient()).auth.getUser()).data.user : null
  if (body.event_name === "consent_revoked") {
    if (consent && (user || uuid(body.anonymous_id))) await createAdminClient().rpc("revoke_growth_consent", { p_user_id: user?.id ?? null, p_anonymous_id: uuid(body.anonymous_id) ? body.anonymous_id : null, p_decided_at: consent.updatedAt })
    return Response.json({ conversions: [] }, { headers })
  }
  if (!consent?.analytics || /bot|crawler|spider|lighthouse|pagespeed/i.test(request.headers.get("user-agent") ?? "")) return Response.json({ conversions: [] }, { headers })
  const context = parseContext(JSON.stringify(body.context))
  if (!context || !["page_view", "listing_started", "listing_publish_failed", "identify", "listing_share_action"].includes(String(body.event_name))) return Response.json({ error: "invalid_event" }, { status: 400, headers })
  if (!uuid(body.event_id) && !(body.event_name === "listing_started" && uuid(body.attempt_id) && body.event_id === `listing_started:${body.attempt_id}`)) return Response.json({ error: "invalid_id" }, { status: 400, headers })
  const path = safePath(body.path)
  if (["listing_started", "listing_publish_failed"].includes(String(body.event_name)) && (!user || path !== "/dashboard/listings/new")) return Response.json({ error: "unauthorized" }, { status: 403, headers })
  const isShare = body.event_name === "listing_share_action"
  if (isShare && (!uuid(body.listing_id) || !isListingShareAction(body.share_action) || path !== "/listing/:id")) return Response.json({ error: "invalid_share" }, { status: 400, headers })
  try {
    const { data, error } = await createAdminClient().rpc("ingest_growth_browser_event", { p_event: { ...context, event_name: body.event_name, event_id: body.event_id, user_id: user?.id ?? null, path, route_group: routeGroup(path), device_class: ["mobile", "tablet", "desktop"].includes(String(body.device_class)) ? body.device_class : "desktop", marketing_consent: consent.marketing === true, consent_updated_at: consent.updatedAt, ...(isShare ? { listing_id: body.listing_id, share_action: body.share_action } : {}), ...(body.event_name === "listing_publish_failed" ? { failure: sanitizePublishFailure(body.failure) } : {}) } })
    if (error) return Response.json({ error: "tracking_unavailable" }, { status: error.code === "P0001" ? 429 : 503, headers })
    if (isShare) return Response.json({ conversions: [] }, { headers })
    after(() => deliverMetaEvents(user?.id).catch(() => undefined))
    return Response.json({ conversions: data ?? [] }, { headers })
  } catch { return Response.json({ error: "tracking_unavailable" }, { status: 503, headers }) }
}
