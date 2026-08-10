export const MARKETPLACE_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "seller_confirmed",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
  "refunded",
] as const

export type MarketplaceOrderStatus = (typeof MARKETPLACE_ORDER_STATUSES)[number]
export type MarketplaceOrderRole = "buyer" | "seller"

export type MarketplaceOrder = {
  id: string
  listing_id: string | null
  buyer_id: string | null
  seller_id: string | null
  status: MarketplaceOrderStatus
  listing_title: string
  listing_slug: string
  listing_cover_image_url: string | null
  item_price: number | string
  delivery_price: number | string
  platform_fee: number | string
  buyer_protection_fee: number | string
  total_amount: number | string
  currency: "GEL"
  delivery_method: string | null
  payment_provider: string | null
  provider_status: string | null
  created_at: string
  updated_at: string
}
