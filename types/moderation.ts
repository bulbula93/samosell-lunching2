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
}

export type UserListingReport = {
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
