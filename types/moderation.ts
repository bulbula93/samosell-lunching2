export type AdminListingReport = {
  id: string
  listing_id: string
  reporter_id: string
  seller_id: string
  reason: string
  details: string | null
  status: string
  moderation_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  listing_slug: string
  listing_title: string
  listing_status: string
  price: number
  currency: string
  cover_image_url: string | null
  reporter_username: string | null
  reporter_full_name: string | null
  seller_username: string | null
  seller_full_name: string | null
  seller_is_suspended: boolean
  updated_at?: string
}

export type AdminUserReport = {
  id: string
  reporter_id: string
  reported_user_id: string
  context_listing_id: string | null
  reason: string
  details: string | null
  status: string
  moderation_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  reporter_username: string | null
  reporter_full_name: string | null
  reported_username: string | null
  reported_full_name: string | null
  reported_avatar_url: string | null
  reported_is_suspended: boolean
  context_listing_slug: string | null
  context_listing_title: string | null
  context_listing_status: string | null
}

export type UserListingReport = {
  kind: "listing"
  id: string
  reason: string
  details: string | null
  status: string
  moderation_note: string | null
  created_at: string
  listing: {
    slug: string
    title: string
  } | null
}

export type UserAccountReport = {
  kind: "user"
  id: string
  reason: string
  details: string | null
  status: string
  moderation_note: string | null
  created_at: string
  reported_user: {
    username: string | null
    full_name: string | null
  } | null
  context_listing: {
    slug: string
    title: string
  } | null
}

export type ModerationAuditEntry = {
  id: string
  report_kind: "listing" | "user"
  report_id: string
  action: string
  target_listing_id: string | null
  target_user_id: string | null
  metadata: {
    previous_status?: string
    next_status?: string
  } | null
  created_at: string
}
