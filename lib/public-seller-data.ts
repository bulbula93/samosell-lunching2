import "server-only"

import { unstable_cache } from "next/cache"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { isReadOnlyPreview } from "@/lib/preview-read-only"
import { fetchSellerReviewData } from "@/lib/reviews"
import { withQueryTimeout } from "@/lib/supabase/query-timeout"
import type { CatalogListing } from "@/types/marketplace"

const listingSelect =
  "id, seller_id, slug, title, description, price, currency, sale_type, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, promotion_tier, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, published_at, favorites_count, views_count, status"

type PublicSellerListingCounts = {
  active_count?: number | string | null
  sold_count?: number | string | null
}

const publicProfileSelect = "id, username, full_name, bio, city, is_seller_verified, is_suspended, created_at, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url, tiktok_username, tiktok_live_until"
export type PublicSellerProfile = {
  id: string; username: string; full_name: string | null; bio: string | null; city: string | null
  is_seller_verified: boolean; is_suspended: boolean; created_at: string
  avatar_url: string | null; seller_type: string | null; store_logo_url: string | null; store_banner_url: string | null
  store_phone: string | null; store_whatsapp: string | null; store_telegram: string | null; store_instagram: string | null
  store_facebook: string | null; store_website: string | null; store_hours: string | null; store_address: string | null
  store_map_url: string | null; tiktok_username: string | null; tiktok_live_until: string | null
}

const loadPublicSeller = async (id: string, username: string) => {
  const supabase = createPublicServerClient()
  const [profile, listings, counts, reviewData] = await Promise.all([
    withQueryTimeout((signal) => supabase.from("profiles").select(publicProfileSelect).eq("id", id).eq("username", username).abortSignal(signal).maybeSingle()),
    withQueryTimeout(supabase.from("listings_catalog").select(listingSelect).eq("status", "active").eq("seller_id", id).eq("seller_username", username).order("published_at", { ascending: false })),
    withQueryTimeout((signal) => supabase.rpc("get_public_seller_listing_counts", { p_seller_id: id }, { get: isReadOnlyPreview() }).abortSignal(signal).maybeSingle()),
    fetchSellerReviewData(supabase, id, { limit: 8 }),
  ])
  const error = profile.error || listings.error || counts.error
  if (error) throw new Error("PUBLIC_SELLER_DATA_FAILED", { cause: error })
  return { profile: profile.data as PublicSellerProfile | null, listings: (listings.data ?? []) as CatalogListing[],
    sellerCounts: counts.data as PublicSellerListingCounts | null, sellerReviewData: reviewData }
}
function makeReader() {
  return unstable_cache(loadPublicSeller, ["public-seller-bundle-v1"], { revalidate: 30, tags: ["public-listings", "public-sellers"] })
}
let read: ReturnType<typeof makeReader> | undefined
export async function getCachedPublicSellerData(id: string, username: string) {
  read ??= makeReader()
  return read(id, username)
}
