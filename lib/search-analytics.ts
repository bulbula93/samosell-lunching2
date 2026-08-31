import type { SupabaseClient } from "@supabase/supabase-js"

export type SearchInteractionType = "click" | "favorite" | "chat_start"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeSearchId(value: unknown) {
  const searchId = typeof value === "string" ? value.trim() : ""
  return UUID_PATTERN.test(searchId) ? searchId : ""
}

export function searchListingHref(slug: string, searchId?: string | null) {
  const id = normalizeSearchId(searchId)
  return id
    ? `/listing/${slug}?search_id=${encodeURIComponent(id)}`
    : `/listing/${slug}`
}

export async function recordSearchInteractionSafely(
  supabase: SupabaseClient,
  input: {
    searchId?: string | null
    listingId: string
    eventType: SearchInteractionType
  },
) {
  const searchId = normalizeSearchId(input.searchId)
  if (!searchId || !UUID_PATTERN.test(input.listingId)) return false

  try {
    const { data, error } = await supabase.rpc("record_search_interaction", {
      p_search_id: searchId,
      p_event_type: input.eventType,
      p_listing_id: input.listingId,
    })

    if (error) {
      console.error("[search-analytics] interaction failed", error.message)
      return false
    }

    return data === true
  } catch (error) {
    console.error(
      "[search-analytics] interaction failed",
      error instanceof Error ? error.message : "unknown error",
    )
    return false
  }
}
