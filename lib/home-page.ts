import "server-only"

import { unstable_cache } from "next/cache"
import type { User } from "@supabase/supabase-js"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import type { CatalogListing } from "@/types/marketplace"
import type { StoryRailData } from "@/types/story"

export const baseListingSelect =
  "id, public_id, slug, title, description, price, currency, condition, city, is_vip, is_promoted, is_featured, brand_name, size_label, category_name, seller_username, seller_full_name, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, status"

export type PopularBrand = {
  name: string
  count: number
}

export type PublicHomePageData = {
  heroItems: CatalogListing[]
  vipItems: CatalogListing[]
  bannerItems: CatalogListing[]
  latestItems: CatalogListing[]
  popularItems: CatalogListing[]
  affordableItems: CatalogListing[]
  vintageItems: CatalogListing[]
  popularBrands: PopularBrand[]
  activeCount: number
}

export type HomePageData = PublicHomePageData & {
  user: User | null
  favoriteIds: string[]
  storyRail?: StoryRailData
}

function emptyPublicHomePageData(): PublicHomePageData {
  return {
    heroItems: [],
    vipItems: [],
    bannerItems: [],
    latestItems: [],
    popularItems: [],
    affordableItems: [],
    vintageItems: [],
    popularBrands: [],
    activeCount: 0,
  }
}

export const getPublicHomePageData = unstable_cache(
  async (): Promise<PublicHomePageData> => {
    const supabase = createPublicServerClient()

    const [
      heroResponse,
      vipResponse,
      bannerResponse,
      latestResponse,
      popularResponse,
      affordableResponse,
      vintageResponse,
      popularBrandsResponse,
      activeCountResponse,
    ] = await Promise.all([
      supabase
        .from("listings_catalog")
        .select(baseListingSelect)
        .eq("status", "active")
        .eq("is_featured", true)
        .eq("is_promoted", true)
        .eq("is_vip", true)
        .not("cover_image_url", "is", null)
        .order("featured_slot", { ascending: true, nullsFirst: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(8),
      supabase
        .from("listings_catalog")
        .select(baseListingSelect)
        .eq("status", "active")
        .eq("is_vip", true)
        .not("cover_image_url", "is", null)
        .order("promotion_tier", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(12),
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
      supabase.rpc("get_home_popular_brands", { p_limit: 8 }),
      supabase
        .from("listings_catalog")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ])

    const criticalError =
      heroResponse.error ||
      vipResponse.error ||
      bannerResponse.error ||
      latestResponse.error ||
      popularResponse.error ||
      affordableResponse.error ||
      vintageResponse.error ||
      popularBrandsResponse.error ||
      activeCountResponse.error

    if (criticalError) {
      if (process.env.CI === "true") {
        return emptyPublicHomePageData()
      }
      throw new Error(`home_public_data_failed:${criticalError.message}`)
    }

    const latestItems = (latestResponse.data ?? []) as CatalogListing[]
    const popularItems = (popularResponse.data ?? []) as CatalogListing[]
    const affordableItems = (affordableResponse.data ?? []) as CatalogListing[]
    const vintageItems = (vintageResponse.data ?? []) as CatalogListing[]
    const heroItems = (heroResponse.data ?? []) as CatalogListing[]
    const popularBrands = ((popularBrandsResponse.data ?? []) as Array<{
      name?: string | null
      count?: number | string | null
    }>)
      .map((row) => ({
        name: String(row.name ?? "").trim(),
        count: Number(row.count ?? 0),
      }))
      .filter((row) => row.name && Number.isFinite(row.count))

    return {
      heroItems,
      vipItems: (vipResponse.data ?? []) as CatalogListing[],
      bannerItems: (bannerResponse.data ?? []) as CatalogListing[],
      latestItems: latestItems.slice(0, 10),
      popularItems: popularItems.slice(0, 10),
      affordableItems: affordableItems.slice(0, 10),
      vintageItems: vintageItems.slice(0, 10),
      popularBrands,
      activeCount: activeCountResponse.count ?? latestItems.length,
    }
  },
  ["home-public-data-v2"],
  {
    revalidate: 60,
    tags: ["home-public-data"],
  },
)
