export const GROWTH_COOKIE = "samosell_growth"
export const GROWTH_KEY = "samosell:growth:v1"
export const TOUCH_TTL = 30 * 86400_000
export const SESSION_TTL = 30 * 60_000
export const EVENT_NAMES = ["page_view", "registration_completed", "listing_started", "listing_published", "listing_edit_completed", "listing_publish_failed", "boost_checkout_started", "boost_purchase_completed", "buyer_contact_started", "listing_share_action"] as const
export type GrowthEventName = typeof EVENT_NAMES[number]
export type Touch = Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term", string>> & { referrer?: string }
export type GrowthContext = { anonymous_id: string; session_id: string; first_touch: Touch; last_touch: Touch; expires_at: number; last_seen: number }
export type GrowthEvent = { event_id: string; event_name: GrowthEventName; user_id?: string | null; anonymous_id?: string | null; session_id?: string | null; path?: string; route_group?: string; device_class?: string; first_touch?: Touch; last_touch?: Touch; marketing_consent?: boolean; occurred_at?: string; listing_id?: string | null; order_id?: string | null; product_id?: string | null; product_type?: string | null; amount?: number | null; currency?: string | null; payment_provider?: string | null }
export const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
export function cleanTouch(input: unknown): Touch {
  if (!input || typeof input !== "object") return {}
  const result: Touch = {}
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    const value = (input as Record<string, unknown>)[key]
    // Campaign labels only. URLs, email addresses, query strings and freeform PII are rejected.
    if (typeof value === "string" && /^[\p{L}\p{N}_ .-]{1,100}$/u.test(value)) result[key] = value
  }
  const ref = (input as Touch).referrer
  try { if (ref) { const url = new URL(ref); if (["http:", "https:"].includes(url.protocol)) result.referrer = url.origin } } catch { /* invalid referrer */ }
  return result
}
export function routeGroup(path: string) {
  if (path.startsWith("/listing/")) return "listing"
  if (path.startsWith("/catalog")) return "catalog"
  if (path.startsWith("/admin")) return "admin"
  if (path.startsWith("/dashboard/listings/new")) return "create_listing"
  if (path.startsWith("/dashboard")) return "dashboard"
  if (["/login", "/register", "/auth/callback", "/reset-password", "/forgot-password"].includes(path)) return "auth"
  return path === "/" ? "home" : path === "/sell" ? "sell" : "other"
}
export function safePath(input: unknown) {
  if (typeof input !== "string" || !input.startsWith("/") || input.startsWith("//")) return "/"
  const path = input.split(/[?#]/)[0].slice(0, 180)
  // User IDs, chat IDs, titles and reset/auth parameters never enter analytics.
  const structural = new Set(["dashboard", "admin", "auth", "listing", "listings", "new", "edit", "promote", "chats", "support", "growth", "callback", "billing", "profile", "notifications", "orders", "favorites", "reports", "ads", "search", "payments", "boosts", "users", "saved-searches"])
  if (/^\/(dashboard|admin|auth|listing|seller|profile)\//.test(path)) return path.split("/").map((segment, i) => !i || (i <= 2 && structural.has(segment)) || ["new", "edit", "promote"].includes(segment) ? segment : ":id").join("/")
  return path
}
export function parseContext(raw: string | null): GrowthContext | null {
  try {
    const value = JSON.parse(raw ?? "null")
    if (!uuid(value?.anonymous_id) || !uuid(value?.session_id) || !Number.isFinite(value.expires_at) || value.expires_at <= Date.now() || value.expires_at > Date.now() + TOUCH_TTL + 60_000 || !Number.isFinite(value.last_seen) || value.last_seen > Date.now() + 60_000) return null
    return { anonymous_id: value.anonymous_id, session_id: value.session_id, expires_at: value.expires_at, last_seen: value.last_seen, first_touch: cleanTouch(value.first_touch), last_touch: cleanTouch(value.last_touch) }
  } catch { return null }
}
export const META_MAPPING: Partial<Record<GrowthEventName, { name: string; custom?: boolean }>> = {
  page_view: { name: "PageView" }, registration_completed: { name: "CompleteRegistration" }, listing_started: { name: "StartListing", custom: true }, listing_published: { name: "PublishListing", custom: true }, boost_checkout_started: { name: "InitiateCheckout" }, boost_purchase_completed: { name: "Purchase" }, buyer_contact_started: { name: "Contact" },
}
export function metaCustomData(event: GrowthEvent) {
  return event.amount != null ? { value: Number(event.amount), currency: "GEL", content_ids: [event.product_id ?? event.listing_id ?? "boost"], content_type: "product", ...(event.order_id ? { order_id: event.order_id } : {}) } : event.listing_id ? { content_ids: [event.listing_id] } : {}
}
export function growthPeriod(period: string, now = new Date()) {
  const days = period === "today" ? 1 : period === "7" ? 7 : 30
  const georgia = new Date(now.getTime() + 4 * 3600_000)
  const from = Date.UTC(georgia.getUTCFullYear(), georgia.getUTCMonth(), georgia.getUTCDate() - days + 1) - 4 * 3600_000
  return { from: new Date(from).toISOString(), to: now.toISOString(), days }
}

export const PUBLISH_FAILURE_STAGES = ["prepare", "upload", "save", "unknown"] as const
export const PUBLISH_FAILURE_CODES = ["unauthorized", "not_found", "invalid", "rate_limited", "server_error", "upload_error", "missing_plan", "transport_error", "exception"] as const
export type PublishFailureStage = typeof PUBLISH_FAILURE_STAGES[number]
export type PublishFailureCode = typeof PUBLISH_FAILURE_CODES[number]
export type PublishFailure = {
  stage: PublishFailureStage
  code: PublishFailureCode
  /** Form field name of the first validation error (structural, never user text). */
  field?: string
  /** HTTP status of a failed photo upload. */
  http_status?: number
  images?: number
  total_mb?: number
  online?: boolean
}
/** Whitelist-only: anything that is not a known stage/code or a bounded number is dropped. */
export function sanitizePublishFailure(input: unknown): PublishFailure | null {
  if (!input || typeof input !== "object") return null
  const raw = input as Record<string, unknown>
  if (!PUBLISH_FAILURE_STAGES.includes(raw.stage as PublishFailureStage)) return null
  if (!PUBLISH_FAILURE_CODES.includes(raw.code as PublishFailureCode)) return null
  const result: PublishFailure = { stage: raw.stage as PublishFailureStage, code: raw.code as PublishFailureCode }
  if (typeof raw.field === "string" && /^[a-z][a-z_]{0,39}$/.test(raw.field)) result.field = raw.field
  if (Number.isInteger(raw.http_status) && (raw.http_status as number) >= 100 && (raw.http_status as number) <= 599) result.http_status = raw.http_status as number
  if (Number.isInteger(raw.images) && (raw.images as number) >= 0 && (raw.images as number) <= 50) result.images = raw.images as number
  if (typeof raw.total_mb === "number" && Number.isFinite(raw.total_mb) && raw.total_mb >= 0 && raw.total_mb <= 500) result.total_mb = Math.round(raw.total_mb * 10) / 10
  if (typeof raw.online === "boolean") result.online = raw.online
  return result
}
