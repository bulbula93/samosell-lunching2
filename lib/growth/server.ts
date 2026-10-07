import "server-only"
import { after } from "next/server"
import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { cookieConsent } from "@/lib/browser-preferences"
import { GROWTH_COOKIE, parseContext, type GrowthEvent, type GrowthEventName } from "./shared"

export function growthWritesEnabled() {
  if (process.env.GROWTH_TRACKING_ENABLED !== "true" || process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") return false
  if (process.env.VERCEL_ENV === "preview") {
    const ref = process.env.PREVIEW_GROWTH_DATABASE_REF
    return Boolean(ref && ref !== "lxsvjzbiuewgwpajqrwr" && process.env.NEXT_PUBLIC_SUPABASE_URL === `https://${ref}.supabase.co`)
  }
  return true
}
export async function requestGrowthContext() {
  const store = await cookies()
  const consent = cookieConsent(store.toString())
  let raw: string | null = null
  try { raw = store.get(GROWTH_COOKIE)?.value ? decodeURIComponent(store.get(GROWTH_COOKIE)!.value) : null } catch { /* malformed optional cookie */ }
  const context = consent?.analytics ? parseContext(raw) : null
  return { ...(context ?? {}), marketing_consent: consent?.marketing === true && consent.analytics === true }
}
// Operational outcomes remain separate from optional visitor/marketing identifiers.
// Analytics failures never turn a successful listing/payment into a failed business operation.
export async function recordGrowthOutcome(event: GrowthEvent) {
  if (!growthWritesEnabled()) return false
  try {
    const { error } = await createAdminClient().rpc("record_growth_outcome", { p_event: event })
    if (error) { console.warn("[growth] outcome unavailable", { code: error.code }); return false }
    scheduleGrowthMetaDelivery(event.user_id ?? undefined)
    return true
  } catch { console.warn("[growth] outcome unavailable"); return false }
}
export async function recordListingOutcome(name: GrowthEventName, userId: string, listingId: string, editId?: string) {
  if (!growthWritesEnabled()) return
  try {
    const context = await requestGrowthContext()
    await recordGrowthOutcome({ ...context, event_name: name, event_id: name === "listing_published" ? `${name}:${listingId}` : `${name}:${listingId}:${editId ?? crypto.randomUUID()}`, user_id: userId, listing_id: listingId, path: "/dashboard/listings/new", route_group: "create_listing" })
  } catch { console.warn("[growth] listing outcome unavailable") }
}
export async function recordGrowthCheckout(userId: string, orderId: string, kind: "boost" | "banner") {
  if (!growthWritesEnabled()) return
  try {
    const context = await requestGrowthContext()
    await recordGrowthOutcome({ ...context, event_name: "boost_checkout_started", event_id: `boost_checkout_started:${kind}:${orderId}`, user_id: userId, order_id: orderId, product_type: kind, path: kind === "boost" ? "/dashboard/billing" : "/advertise", route_group: "checkout" })
  } catch { console.warn("[growth] checkout outcome unavailable") }
}

export function scheduleGrowthMetaDelivery(userId?: string) {
  if (!growthWritesEnabled() || process.env.META_CAPI_ENABLED !== "true") return
  try { after(async () => { const { deliverMetaEvents } = await import("./meta-server"); await deliverMetaEvents(userId).catch(() => undefined) }) } catch { /* Outbox remains durable for later retry. */ }
}
