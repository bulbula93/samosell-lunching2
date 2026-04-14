export type BoostProduct = {
  id: string
  name: string
  placement: string
  duration_days: number
  price: number
  currency: string
  description: string | null
  is_active: boolean
  sort_order: number
}

export type BoostOrder = {
  id: string
  listing_id: string
  seller_id: string
  product_id: string
  status: string
  payment_method: string
  payment_reference: string | null
  amount: number
  currency: string
  notes: string | null
  admin_note: string | null
  starts_at: string | null
  ends_at: string | null
  approved_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
  payment_provider?: string | null
  provider_payment_id?: string | null
  provider_checkout_url?: string | null
  provider_status?: string | null
  provider_result_code?: string | null
  checkout_session_started_at?: string | null
  last_payment_sync_at?: string | null
  paid_at?: string | null
  cancelled_at?: string | null
  failure_reason?: string | null
  listing_title?: string | null
  listing_slug?: string | null
  cover_image_url?: string | null
  product_name?: string | null
  placement?: string | null
  duration_days?: number | null
  seller_username?: string | null
  seller_full_name?: string | null
}

export type PromotionState = {
  is_vip: boolean
  is_promoted?: boolean
  is_featured?: boolean
  vip_until?: string | null
  promoted_until?: string | null
  featured_until?: string | null
  featured_slot?: number | null
}
