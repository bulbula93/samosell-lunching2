import { SITE_STORAGE_NAMESPACE } from "@/lib/site"

export const RECENTLY_VIEWED_STORAGE_KEY = `${SITE_STORAGE_NAMESPACE}-recently-viewed`
const MAX_RECENTLY_VIEWED = 12

export function readRecentlyViewedIds() {
  if (typeof window === "undefined") return [] as string[]
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return []
  }
}

export function rememberRecentlyViewed(listingId: string) {
  if (typeof window === "undefined" || !listingId) return [] as string[]
  const current = readRecentlyViewedIds().filter((id) => id !== listingId)
  const next = [listingId, ...current].slice(0, MAX_RECENTLY_VIEWED)
  window.localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event("recently-viewed-updated"))
  return next
}
