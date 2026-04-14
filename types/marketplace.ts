export type LookupItem = {
  id: string
  name?: string
  slug?: string
  label?: string
  group_name?: string
}

export type MarketplaceCounts = {
  categories: number
  brands: number
  sizes: number
  listings: number
}

export type CatalogListing = {
  id: string
  seller_id?: string
  slug: string
  title: string
  description?: string | null
  price: number
  currency: string
  condition: string
  gender?: string | null
  city: string | null
  material?: string | null
  color?: string | null
  is_vip: boolean
  is_promoted?: boolean
  is_featured?: boolean
  vip_until?: string | null
  promoted_until?: string | null
  featured_until?: string | null
  featured_slot?: number | null
  brand_name: string | null
  size_label: string | null
  category_name: string
  category_slug?: string | null
  seller_username: string | null
  seller_full_name?: string | null
  seller_created_at?: string | null
  seller_is_verified?: boolean
  seller_type?: string | null
  seller_avatar_url?: string | null
  seller_store_logo_url?: string | null
  cover_image_url: string | null
  published_at?: string | null
  favorites_count?: number
  views_count?: number
  status?: string | null
}

export type ListingImage = {
  id: string
  image_url: string
  sort_order: number
}

export type ListingFormInitialData = {
  id?: string
  title: string
  description: string
  price: string
  category_id: number | ""
  brand_id: string
  size_id: string
  condition: string
  sale_type: string
  gender: string
  color: string
  material: string
  city: string
  status: string
  published_at?: string | null
  images: ListingImage[]
}
