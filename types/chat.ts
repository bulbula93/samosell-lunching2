export type ChatThread = {
  id: string
  chat_type: "listing" | "direct"
  listing_id: string | null
  buyer_id: string
  seller_id: string
  created_at: string
  last_message_at: string | null
  buyer_last_read_at?: string | null
  seller_last_read_at?: string | null
  listing_slug: string | null
  listing_title: string | null
  price: number | null
  currency: string | null
  listing_status: string | null
  cover_image_url: string | null
  counterparty_id: string
  counterparty_username: string | null
  counterparty_full_name: string | null
  counterparty_city: string | null
  counterparty_avatar_url?: string | null
  last_message_body: string | null
  last_message_sender_id: string | null
  last_message_created_at: string | null
  unread_count: number
  sort_at: string
  is_archived?: boolean
}

export type ChatMessage = {
  id: string
  chat_id: string
  sender_id: string
  body: string
  created_at: string
  message_type?: "text" | "story_reply"
  story_id?: string | null
  story_context?: {
    available: boolean
    caption: string | null
    linkedListingSlug: string | null
  } | null
}

export type ChatMessageCursor = {
  createdAt: string
  id: string
}
