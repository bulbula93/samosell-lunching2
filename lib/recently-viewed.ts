import { readPreference, writePreference } from "@/lib/browser-preferences"
import { SITE_STORAGE_NAMESPACE } from "@/lib/site"

export const RECENTLY_VIEWED_STORAGE_KEY = `${SITE_STORAGE_NAMESPACE}-recently-viewed`
const MAX_RECENTLY_VIEWED = 12

export function readRecentlyViewedIds() {
  const stored = readPreference<unknown>(RECENTLY_VIEWED_STORAGE_KEY)
  if (!Array.isArray(stored)) return [] as string[]
  return stored.filter((item): item is string => typeof item === "string" && /^[a-f0-9-]{36}$/i.test(item)).slice(0, MAX_RECENTLY_VIEWED)
}

export function rememberRecentlyViewed(listingId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(listingId)) return [] as string[]
  const current = readRecentlyViewedIds().filter((id) => id !== listingId)
  const next = [listingId, ...current].slice(0, MAX_RECENTLY_VIEWED)
  if (!writePreference(RECENTLY_VIEWED_STORAGE_KEY, next)) return []
  window.dispatchEvent(new Event("recently-viewed-updated"))
  return next
}
