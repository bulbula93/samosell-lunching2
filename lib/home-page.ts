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

const HOME_QUERY_BUDGET_MS = 2500

async function settleHomeQuery<T>(
  query: PromiseLike<T>,
  section: string,
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      Promise.resolve(query).catch((error) => {
        console.warn(
          "home_public_data_partial",
          section,
          error instanceof Error ? error.message : "query_failed",
        )
        return null
      }),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn("home_public_data_partial", section, "client_timeout")
          resolve(null)
        }, HOME_QUERY_BUDGET_MS)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
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
      settleHomeQuery(
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
        "hero",
      ),
      settleHomeQuery(
        supabase
          .from("listings_catalog")
          .select(baseListingSelect)
          .eq("status", "active")
          .eq("is_vip", true)
          .not("cover_image_url", "is", null)
          .order("promotion_tier", { ascending: false })
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(12),
        "vip",
      ),
      settleHomeQuery(
        supabase
          .from("listings_catalog")
          .select(baseListingSelect)
          .eq("status", "active")
          .eq("is_home_banner", true)
          .order("home_banner_slot", { ascending: true, nullsFirst: false })
          .limit(4),
        "banner",
      ),
      settleHomeQuery(
        supabase
          .from("listings_catalog")
          .select(baseListingSelect)
          .eq("status", "active")
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(12),
        "latest",
      ),
      settleHomeQuery(
        supabase
          .from("listings_catalog")
          .select(baseListingSelect)
          .eq("status", "active")
          .order("favorites_count", { ascending: false, nullsFirst: false })
          .order("views_count", { ascending: false, nullsFirst: false })
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(12),
        "popular",
      ),
      settleHomeQuery(
        supabase
          .from("listings_catalog")
          .select(baseListingSelect)
          .eq("status", "active")
          .order("price", { ascending: true })
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(12),
        "affordable",
      ),
      settleHomeQuery(
        supabase
          .from("listings_catalog")
          .select(baseListingSelect)
          .eq("status", "active")
          .eq("category_slug", "vintage")
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(12),
        "vintage",
      ),
      settleHomeQuery(
        supabase.rpc("get_home_popular_brands", { p_limit: 8 }),
        "popular_brands",
      ),
      settleHomeQuery(
        supabase
          .from("listings_catalog")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        "active_count",
      ),
    ])

    const responses = [
      ["hero", heroResponse],
      ["vip", vipResponse],
      ["banner", bannerResponse],
      ["latest", latestResponse],
      ["popular", popularResponse],
      ["affordable", affordableResponse],
      ["vintage", vintageResponse],
      ["popular_brands", popularBrandsResponse],
      ["active_count", activeCountResponse],
    ] as const

    for (const [section, response] of responses) {
      if (response && "error" in response && response.error) {
        console.warn("home_public_data_partial", section, response.error.message)
      }
    }

    const latestItems = (latestResponse?.data ?? []) as CatalogListing[]
    const popularItems = (popularResponse?.data ?? []) as CatalogListing[]
    const affordableItems = (affordableResponse?.data ?? []) as CatalogListing[]
    const vintageItems = (vintageResponse?.data ?? []) as CatalogListing[]
    const heroItems = (heroResponse?.data ?? []) as CatalogListing[]
    const popularBrands = ((popularBrandsResponse?.data ?? []) as Array<{
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
      vipItems: (vipResponse?.data ?? []) as CatalogListing[],
      bannerItems: (bannerResponse?.data ?? []) as CatalogListing[],
      latestItems: latestItems.slice(0, 10),
      popularItems: popularItems.slice(0, 10),
      affordableItems: affordableItems.slice(0, 10),
      vintageItems: vintageItems.slice(0, 10),
      popularBrands,
      activeCount: activeCountResponse?.count ?? latestItems.length,
    }
  },
  ["home-public-data-v3"],
  {
    revalidate: 60,
    tags: ["home-public-data"],
  },
)
