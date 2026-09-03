import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isAdPagePathAllowed,
  isAdPlacementKey,
  normalizeAdPagePath,
  normalizeAdTargetUrl,
  type AdEventType,
  type AdPlacementKey,
} from "@/lib/ads"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_BUCKET_MS = 10 * 60 * 1000

type TrackableAd = {
  id: string
  placement_key: AdPlacementKey
  target_url: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
}

export type ValidAdEventInput = {
  adId: string
  placementKey: AdPlacementKey
  pagePath: string
  eventType: AdEventType
}

export type AdRequestIdentity = {
  ip: string
  userAgent: string
}

export function parseAdEventInput(value: unknown): ValidAdEventInput | null {
  if (!value || typeof value !== "object") return null
  const payload = value as Record<string, unknown>
  const adId = typeof payload.adId === "string" ? payload.adId.trim() : ""
  const pagePath = normalizeAdPagePath(payload.pagePath)
  if (!UUID_PATTERN.test(adId) || !isAdPlacementKey(payload.placementKey) || !pagePath) return null
  if (!isAdPagePathAllowed(payload.placementKey, pagePath)) return null
  if (payload.eventType !== "impression" && payload.eventType !== "click") return null
  return { adId, placementKey: payload.placementKey, pagePath, eventType: payload.eventType }
}

export function getAdRequestIdentity(headers: Headers): AdRequestIdentity {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return {
    ip: forwarded || headers.get("x-real-ip")?.trim() || "unknown",
    userAgent: headers.get("user-agent")?.slice(0, 500) || "unknown",
  }
}

function isWithinActiveWindow(ad: TrackableAd, now = Date.now()) {
  if (!ad.is_active) return false
  const startsAt = ad.starts_at ? Date.parse(ad.starts_at) : null
  const endsAt = ad.ends_at ? Date.parse(ad.ends_at) : null
  if (startsAt !== null && (!Number.isFinite(startsAt) || startsAt > now)) return false
  if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt < now)) return false
  return true
}

export async function getTrackableAd(adId: string, placementKey: AdPlacementKey) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("ads")
    .select("id, placement_key, target_url, is_active, starts_at, ends_at")
    .eq("id", adId)
    .eq("placement_key", placementKey)
    .maybeSingle()

  if (error || !data) return null
  const ad = data as TrackableAd
  return isWithinActiveWindow(ad) ? ad : null
}

export async function recordResolvedAdEvent(
  ad: TrackableAd,
  input: ValidAdEventInput,
  identity: AdRequestIdentity,
) {
  const bucket = Math.floor(Date.now() / EVENT_BUCKET_MS)
  const dedupeKey = createHash("sha256")
    .update([ad.id, input.placementKey, input.eventType, input.pagePath, bucket, identity.ip, identity.userAgent].join("\u001f"))
    .digest("hex")

  const supabase = createAdminClient()
  const { error } = await supabase.from("ad_events").insert({
    ad_id: ad.id,
    placement_key: input.placementKey,
    event_type: input.eventType,
    page_path: input.pagePath,
    dedupe_key: dedupeKey,
  })

  if (error && error.code !== "23505") {
    console.error("[ads] event recording failed")
  }
}

export async function recordAdEvent(input: ValidAdEventInput, identity: AdRequestIdentity) {
  const ad = await getTrackableAd(input.adId, input.placementKey)
  if (!ad) return false
  await recordResolvedAdEvent(ad, input, identity)
  return true
}

export function getTrackableTarget(ad: TrackableAd) {
  return normalizeAdTargetUrl(ad.target_url)
}
