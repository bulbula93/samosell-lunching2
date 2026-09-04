import {
  AD_PLACEMENT_KEYS,
  isAdPlacementKey,
  normalizeAdTargetUrl,
  type AdPlacementKey,
} from "@/lib/ads"

export const AD_IMAGE_BUCKET = "ad-images"
export const AD_DURATION_DAYS = 7
export const AD_DURATION_MS = AD_DURATION_DAYS * 24 * 60 * 60 * 1000
// Keep the multipart Server Action safely below Next.js' default 1 MB body limit.
export const MAX_AD_IMAGE_FILE_SIZE_BYTES = 850 * 1024

export const AD_PLACEMENT_LABELS: Record<AdPlacementKey, string> = {
  home_hero_left: "მთავარი — Hero მარცხენა",
  home_hero_right: "მთავარი — Hero მარჯვენა",
  listing_after_details_left: "განცხადება — დეტალების შემდეგ მარცხენა",
  listing_after_details_right: "განცხადება — დეტალების შემდეგ მარჯვენა",
  catalog_top_left: "კატალოგი — ზედა მარცხენა",
  catalog_top_right: "კატალოგი — ზედა მარჯვენა",
  sell_bottom_left: "ახალი განცხადება — ფორმის ქვემოთ მარცხენა",
  sell_bottom_right: "ახალი განცხადება — ფორმის ქვემოთ მარჯვენა",
  profile_inline_left: "გამყიდველის გვერდი — მარცხენა",
  profile_inline_right: "გამყიდველის გვერდი — მარჯვენა",
}

export type AdminAdInput = {
  advertiserName: string
  title: string
  description: string | null
  placementKey: AdPlacementKey
  targetUrl: string
  priority: number
}

export type AdminAdValidation =
  | { ok: true; data: AdminAdInput }
  | {
      ok: false
      code: "advertiser" | "title" | "description" | "placement" | "target" | "priority"
    }

export function isAdId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function validateAdminAdInput(input: {
  advertiserName?: unknown
  title?: unknown
  description?: unknown
  placementKey?: unknown
  targetUrl?: unknown
  priority?: unknown
}): AdminAdValidation {
  const advertiserName = String(input.advertiserName ?? "").trim()
  const title = String(input.title ?? "").trim()
  const description = String(input.description ?? "").trim()
  const targetUrl = normalizeAdTargetUrl(String(input.targetUrl ?? ""))
  const priorityText = String(input.priority ?? "0").trim()
  const priority = Number(priorityText || "0")

  if (!advertiserName || advertiserName.length > 120) return { ok: false, code: "advertiser" }
  if (!title || title.length > 120) return { ok: false, code: "title" }
  if (description.length > 280) return { ok: false, code: "description" }
  if (!isAdPlacementKey(input.placementKey)) return { ok: false, code: "placement" }
  if (!targetUrl) return { ok: false, code: "target" }
  if (!Number.isSafeInteger(priority) || priority < -1000 || priority > 1000) {
    return { ok: false, code: "priority" }
  }

  return {
    ok: true,
    data: {
      advertiserName,
      title,
      description: description || null,
      placementKey: input.placementKey,
      targetUrl,
      priority,
    },
  }
}

export function createSevenDayAdSchedule(now = new Date()) {
  const startsAt = new Date(now)
  const endsAt = new Date(startsAt.getTime() + AD_DURATION_MS)
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }
}

export type AdminAdStatus = "active" | "scheduled" | "expired" | "stopped" | "draft"

export function getAdminAdStatus(
  ad: { is_active: boolean; starts_at: string | null; ends_at: string | null },
  now = new Date(),
): AdminAdStatus {
  const timestamp = now.getTime()
  const startsAt = ad.starts_at ? Date.parse(ad.starts_at) : null
  const endsAt = ad.ends_at ? Date.parse(ad.ends_at) : null

  if (ad.is_active && startsAt !== null && Number.isFinite(startsAt) && startsAt > timestamp) return "scheduled"
  if (ad.is_active && endsAt !== null && Number.isFinite(endsAt) && endsAt < timestamp) return "expired"
  if (ad.is_active) return "active"
  if (ad.starts_at || ad.ends_at) return "stopped"
  return "draft"
}

export const ADMIN_AD_PLACEMENTS = AD_PLACEMENT_KEYS.map((key) => ({
  key,
  label: AD_PLACEMENT_LABELS[key],
}))
