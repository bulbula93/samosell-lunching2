import "server-only"
import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { growthWritesEnabled } from "./server"
import { META_MAPPING, metaCustomData, type GrowthEvent } from "./shared"

export function metaServerPayload(event: GrowthEvent) {
  const mapping = META_MAPPING[event.event_name]
  if (!mapping || !event.marketing_consent) return null
  const identifier = event.user_id ?? event.anonymous_id
  if (!identifier) return null
  return { event_name: mapping.name, event_id: event.event_id, event_time: Math.floor(new Date(event.occurred_at ?? Date.now()).getTime() / 1000), action_source: "website", event_source_url: `${process.env.SITE_URL ?? "https://samosell.ge"}${event.path ?? "/"}`, user_data: { external_id: [createHash("sha256").update(identifier).digest("hex")] }, custom_data: metaCustomData(event) }
}
// Persistent lease/outbox permits retries after missed callbacks, with identical Meta event IDs.
// No raw email, IP, user agent, auth data or card fields are sent.
export async function deliverMetaEvents(userId?: string) {
  const pixel = process.env.META_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN
  const version = process.env.META_GRAPH_API_VERSION
  if (!growthWritesEnabled() || process.env.META_CAPI_ENABLED !== "true" || !pixel || !/^\d+$/.test(pixel) || !token || !version || !/^v\d+\.0$/.test(version)) return
  if (process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.NEXT_PUBLIC_META_PIXEL_ID !== pixel) return
  if (process.env.VERCEL_ENV === "preview" && !process.env.META_TEST_EVENT_CODE) return
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("claim_growth_meta_events", { p_user_id: userId ?? null, p_limit: 20 })
  if (error || !Array.isArray(data)) return
  for (const event of data as GrowthEvent[]) {
    const payload = metaServerPayload(event)
    if (!payload) continue
    try {
      const response = await fetch(`https://graph.facebook.com/${version}/${pixel}/events`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ data: [payload], ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}) }), signal: AbortSignal.timeout(2500) })
      const result = await response.json()
      if (response.ok && result.events_received === 1) await admin.from("growth_events").update({ meta_sent_at: new Date().toISOString(), meta_claimed_at: null }).eq("event_id", event.event_id)
    } catch { /* Lease expires, later delivery retries the same event_id. Never log provider payloads/token. */ }
  }
}
