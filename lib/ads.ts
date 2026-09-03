import { getSafeImageSource } from "@/lib/media"

export const ADVERTISE_WITH_US_HREF = "/contact?topic=advertising"

export const AD_PLACEMENT_KEYS = [
  "home_hero_left",
  "home_hero_right",
  "listing_after_details_left",
  "listing_after_details_right",
  "catalog_top_left",
  "catalog_top_right",
  "sell_bottom_left",
  "sell_bottom_right",
  "profile_inline_left",
  "profile_inline_right",
] as const

export type AdPlacementKey = (typeof AD_PLACEMENT_KEYS)[number]
export type AdEventType = "impression" | "click"

export type AdRecord = {
  id: string
  placement_key: AdPlacementKey
  title: string | null
  description: string | null
  image_url: string | null
  target_url: string | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  priority: number
  advertiser_name: string | null
  created_at: string
}

export type AdsByPlacement = Partial<Record<AdPlacementKey, AdRecord>>

const placementKeySet = new Set<string>(AD_PLACEMENT_KEYS)

export function isAdPlacementKey(value: unknown): value is AdPlacementKey {
  return typeof value === "string" && placementKeySet.has(value)
}

export function normalizeAdPagePath(value: unknown) {
  if (typeof value !== "string") return null
  const path = value.trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 500) return null
  return path
}

export function isAdPagePathAllowed(placementKey: AdPlacementKey, pagePath: string) {
  switch (placementKey) {
    case "home_hero_left":
    case "home_hero_right":
      return pagePath === "/"
    case "listing_after_details_left":
    case "listing_after_details_right":
      return pagePath.startsWith("/listing/")
    case "catalog_top_left":
    case "catalog_top_right":
      return pagePath === "/catalog" || pagePath.startsWith("/catalog?")
    case "sell_bottom_left":
    case "sell_bottom_right":
      return pagePath === "/dashboard/listings/new"
    case "profile_inline_left":
    case "profile_inline_right":
      return pagePath.startsWith("/seller/")
  }
}

export function normalizeAdTargetUrl(value?: string | null) {
  const target = String(value ?? "").trim()
  if (!target) return null
  if (target.startsWith("/") && !target.startsWith("//")) return target

  try {
    const url = new URL(target)
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null
  } catch {
    return null
  }
}

export function isExternalAdTarget(value?: string | null) {
  const target = normalizeAdTargetUrl(value)
  return Boolean(target && /^https?:\/\//i.test(target))
}

export function getSafeAdImage(value?: string | null) {
  return getSafeImageSource(value)
}

export function isAdActive(ad: AdRecord, now = new Date()) {
  if (!ad.is_active) return false
  const timestamp = now.getTime()
  const startsAt = ad.starts_at ? Date.parse(ad.starts_at) : null
  const endsAt = ad.ends_at ? Date.parse(ad.ends_at) : null
  if (startsAt !== null && (!Number.isFinite(startsAt) || startsAt > timestamp)) return false
  if (endsAt !== null && (!Number.isFinite(endsAt) || endsAt < timestamp)) return false
  return true
}

export function selectActiveAds(
  records: AdRecord[],
  placementKeys: readonly AdPlacementKey[],
  now = new Date(),
) {
  const requested = new Set<AdPlacementKey>(placementKeys)
  const selected: AdsByPlacement = {}
  const sorted = [...records].sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority
    return Date.parse(right.created_at) - Date.parse(left.created_at)
  })

  for (const ad of sorted) {
    if (!requested.has(ad.placement_key) || selected[ad.placement_key] || !isAdActive(ad, now)) continue
    selected[ad.placement_key] = ad
  }

  return selected
}

export function getAdClickHref(ad: AdRecord, pagePath: string) {
  const params = new URLSearchParams({
    ad_id: ad.id,
    placement: ad.placement_key,
    page: normalizeAdPagePath(pagePath) ?? "/",
  })
  return `/api/ads/click?${params.toString()}`
}
