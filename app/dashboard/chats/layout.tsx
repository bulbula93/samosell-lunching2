import ChatWorkspace from "@/components/chat/ChatWorkspace"
import { createClient } from "@/lib/supabase/server"
import type { ReactNode } from "react"
import type { ChatThread } from "@/types/chat"

const CHAT_SIDEBAR_LIMIT = 100

export default async function ChatsLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Let the leaf route perform the redirect so a direct thread URL can preserve
  // `/dashboard/chats/{chatId}` as its post-login destination.
  if (!user) return children

  const participantFilter = `buyer_id.eq.${user.id},seller_id.eq.${user.id}`
  const { data, error } = await supabase
    .from("chat_threads")
    .select(
      "id, chat_type, listing_id, buyer_id, seller_id, created_at, last_message_at, buyer_last_read_at, seller_last_read_at, listing_slug, listing_title, price, currency, listing_status, cover_image_url, counterparty_id, counterparty_username, counterparty_full_name, counterparty_city, last_message_body, last_message_sender_id, last_message_created_at, unread_count, sort_at, is_archived, counterparty_avatar_url",
    )
    .or(participantFilter)
    .order("sort_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_SIDEBAR_LIMIT)

  if (error) {
    throw new Error("CHAT_INBOX_QUERY_FAILED", { cause: error })
  }

  return (
    <ChatWorkspace
      currentUserId={user.id}
      initialThreads={(data ?? []) as ChatThread[]}
    >
      {children}
    </ChatWorkspace>
  )
}
