"use client"
import { allowsAnalytics, getBrowserConsent } from "@/lib/browser-preferences"
import { GROWTH_COOKIE, GROWTH_KEY, TOUCH_TTL, SESSION_TTL, cleanTouch, parseContext, routeGroup, safePath, type GrowthContext, type GrowthEventName, type Touch, uuid } from "./shared"

let memory: GrowthContext | null = null
const pending = new Map<string, Promise<void>>()
export function clearGrowthStorage() {
  memory = null
  try { localStorage.removeItem(GROWTH_KEY); for (const key of Object.keys(sessionStorage)) if (key.startsWith(`${GROWTH_KEY}:`) || key.startsWith("samosell:meta:")) sessionStorage.removeItem(key) } catch { /* unavailable */ }
  try { document.cookie = `${GROWTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax` } catch { /* unavailable */ }
}
export function growthContext(): GrowthContext | null {
  if (!allowsAnalytics()) { clearGrowthStorage(); return null }
  let old = memory
  try { old = parseContext(localStorage.getItem(GROWTH_KEY)) ?? old } catch { /* memory fallback */ }
  if (old && old.expires_at <= Date.now()) old = null
  const params = new URLSearchParams(window.location.search)
  const current = cleanTouch(Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map(key => [key, params.get(key)])))
  const tagged = Boolean(current.utm_source || current.utm_campaign)
  const incoming: Touch = { ...current, ...cleanTouch({ referrer: document.referrer }) }
  const context: GrowthContext = {
    anonymous_id: old?.anonymous_id ?? crypto.randomUUID(),
    session_id: old && Date.now() - old.last_seen < SESSION_TTL ? old.session_id : crypto.randomUUID(),
    first_touch: old?.first_touch ?? incoming,
    last_touch: tagged ? incoming : old?.last_touch ?? incoming,
    expires_at: old?.expires_at ?? Date.now() + TOUCH_TTL, last_seen: Date.now(),
  }
  memory = context
  const raw = JSON.stringify(context)
  try { localStorage.setItem(GROWTH_KEY, raw) } catch { /* consented memory only */ }
  try { document.cookie = `${GROWTH_COOKIE}=${encodeURIComponent(raw)}; Path=/; Max-Age=${Math.ceil((context.expires_at - Date.now()) / 1000)}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}` } catch { /* unavailable */ }
  return context
}
export function trackGrowth(eventName: "page_view" | "listing_started" | "listing_publish_failed" | "identify", eventId = crypto.randomUUID(), attemptId?: string): Promise<void> {
  if (!allowsAnalytics() || process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") return Promise.resolve()
  if (pending.has(eventId)) return pending.get(eventId)!
  const context = growthContext()
  if (!context) return Promise.resolve()
  const path = safePath(location.pathname)
  const task = fetch("/api/growth/events", {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
    body: JSON.stringify({ event_name: eventName, event_id: eventId, attempt_id: attemptId, context, path, route_group: routeGroup(location.pathname), device_class: innerWidth < 768 ? "mobile" : innerWidth < 1024 ? "tablet" : "desktop" }),
  }).then(async response => {
    if (!response.ok) return
    const data = await response.json()
    if (getBrowserConsent()?.marketing) {
      const { trackMetaBrowser } = await import("./meta-browser")
      for (const event of data.conversions ?? []) trackMetaBrowser(event)
    }
  }).catch(() => undefined).finally(() => { pending.delete(eventId) })
  pending.set(eventId, task)
  return task
}
export function interactionEvent(attemptId: string, name: GrowthEventName = "listing_started") { return `${name}:${attemptId}` }

export function listingAttempt(userId?: string) {
  const key = `${GROWTH_KEY}:listing:${userId ?? "current"}`
  if (allowsAnalytics()) { try { const old = sessionStorage.getItem(key); if (uuid(old)) return old } catch { /* unavailable */ } }
  const id = crypto.randomUUID()
  if (allowsAnalytics()) { try { sessionStorage.setItem(key, id) } catch { /* unavailable */ } }
  return id
}
export function clearListingAttempt(userId?: string) { try { sessionStorage.removeItem(`${GROWTH_KEY}:listing:${userId ?? "current"}`) } catch { /* unavailable */ } }
