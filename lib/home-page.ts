import "server-only"

import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

export const baseListingSelect =
  "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, is_home_banner, vip_until, promoted_until, featured_until, featured_slot, home_banner_until, home_banner_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, published_at, favorites_count, views_count, status"

export type PopularBrand = {
  name: string
  count: number
}

export type HomePageData = {
  user: User | null
  heroItems: CatalogListing[]
  bannerItems: CatalogListing[]
  latestItems: CatalogListing[]
  popularItems: CatalogListing[]
  affordableItems: CatalogListing[]
  vintageItems: CatalogListing[]
  popularBrands: PopularBrand[]
  favoriteIds: string[]
  activeCount: number
}

function buildPopularBrands(rows: Array<{ brand_name?: string | null }>) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const name = String(row.brand_name ?? "").trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "ka"))
    .slice(0, 8)
}

export async function getHomePageData(): Promise<HomePageData> {
  const supabase = await createClient()

  const [
    authResponse,
    heroResponse,
    bannerResponse,
    latestResponse,
    popularResponse,
    affordableResponse,
    vintageResponse,
    brandRowsResponse,
    activeCountResponse,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("listings_catalog")
      .select(baseListingSelect)
      .eq("status", "active")
      .not("cover_image_url", "is", null)
      .order("is_vip", { ascending: false })
      .order("is_featured", { ascending: false })
      .order("is_promoted", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3),
    supabase
      .from("listings_catalog")
      .select(baseListingSelect)
      .eq("status", "active")
      .eq("is_home_banner", true)
      .order("home_banner_slot", { ascending: true, nullsFirst: false })
      .limit(4),
    supabase
      .from("listings_catalog")
      .select(baseListingSelect)
      .eq("status", "active")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from("listings_catalog")
      .select(baseListingSelect)
      .eq("status", "active")
      .order("favorites_count", { ascending: false, nullsFirst: false })
      .order("views_count", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from("listings_catalog")
      .select(baseListingSelect)
      .eq("status", "active")
      .order("price", { ascending: true })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from("listings_catalog")
      .select(baseListingSelect)
      .eq("status", "active")
      .eq("category_slug", "vintage")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(12),
    supabase.from("listings_catalog").select("brand_name").eq("status", "active").not("brand_name", "is", null),
    supabase.from("listings_catalog").select("id", { count: "exact", head: true }).eq("status", "active"),
  ])

  const criticalError =
    heroResponse.error ||
    latestResponse.error ||
    popularResponse.error ||
    affordableResponse.error ||
    vintageResponse.error ||
    brandRowsResponse.error ||
    activeCountResponse.error

  if (criticalError) {
    throw new Error(`home_data_failed:${criticalError.message}`)
  }

  const user = authResponse.data.user
  const latestItems = (latestResponse.data ?? []) as CatalogListing[]
  const popularItems = (popularResponse.data ?? []) as CatalogListing[]
  const affordableItems = (affordableResponse.data ?? []) as CatalogListing[]
  const vintageItems = (vintageResponse.data ?? []) as CatalogListing[]
  const heroItems = (heroResponse.data ?? []) as CatalogListing[]

  const favoritesResponse = user
    ? await supabase.from("favorites").select("listing_id").eq("user_id", user.id)
    : { data: [] as { listing_id: string }[], error: null }

  if (favoritesResponse.error) {
    throw new Error(`home_favorites_failed:${favoritesResponse.error.message}`)
  }

  return {
    user,
    heroItems,
    bannerItems: (bannerResponse.data ?? []) as CatalogListing[],
    latestItems: latestItems.slice(0, 10),
    popularItems: popularItems.slice(0, 10),
    affordableItems: affordableItems.slice(0, 10),
    vintageItems: vintageItems.slice(0, 10),
    popularBrands: buildPopularBrands(brandRowsResponse.data ?? []),
    favoriteIds: (favoritesResponse.data ?? []).map((item) => item.listing_id),
    activeCount: activeCountResponse.count ?? latestItems.length,
  }
}
