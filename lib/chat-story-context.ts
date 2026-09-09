import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ChatMessage } from "@/types/chat"

/** Use the caller's RLS client, including for embedded listing context. */
export async function hydrateStoryContexts(supabase: SupabaseClient, messages: ChatMessage[]) {
  const ids = [...new Set(messages.filter(m => m.message_type === "story_reply").map(m => m.story_id).filter((id): id is string => Boolean(id)))]
  const { data, error } = ids.length ? await supabase.from("stories")
    .select("id, caption, listing:listings(slug,status)")
    .in("id", ids).is("deleted_at", null).gt("expires_at", new Date().toISOString()) : { data: [], error: null }
  if (error) throw new Error("CHAT_STORY_CONTEXT_QUERY_FAILED", { cause: error })
  const contexts = new Map((data ?? []).map(row => {
    const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing
    return [row.id, { available: true, caption: row.caption, linkedListingSlug: listing?.status === "active" ? listing.slug : null }]
  }))
  for (const message of messages) {
    if (message.message_type === "story_reply") message.story_context = contexts.get(message.story_id ?? "") ?? { available: false, caption: null, linkedListingSlug: null }
  }
}
