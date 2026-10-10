import "server-only"

import { unstable_cache } from "next/cache"
import type { User } from "@supabase/supabase-js"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { PUBLIC_QUERY_TIMEOUT_MS, withQueryTimeout } from "@/lib/supabase/query-timeout"
import type { CatalogListing } from "@/types/marketplace"
import type { StoryRailData } from "@/types/story"

export const baseListingSelect =
  "id, public_id, slug, title, description, price, currency, condition, sale_type, city, is_vip, is_promoted, is_featured, brand_name, size_label, category_name, seller_username, seller_full_name, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, status"

const HOME_LISTING_SELECT = [
  baseListingSelect,
  "published_at",
  "featured_slot",
  "promotion_tier",
  "is_home_banner",
  "home_banner_slot",
  "favorites_count",
  "views_count",
  "category_slug",
].join(", ")

type HomeListingRow = CatalogListing & {
  published_at?: string | null
  featured_slot?: number | null
  promotion_tier?: number | null
  is_home_banner?: boolean | null
  home_banner_slot?: number | null
  favorites_count?: number | null
  views_count?: number | null
  category_slug?: string | null
}

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

const HOME_QUERY_BUDGET_MS = PUBLIC_QUERY_TIMEOUT_MS
const HOME_POOL_LIMIT = 200

async function settleHomeQuery<T>(
  query: PromiseLike<T>,
  section: string,
): Promise<T | null> {
  const startedAt = Date.now()
  let queryTimedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const trackedQuery = Promise.resolve(query).then(
    (value) => {
      const elapsedMs = Date.now() - startedAt
      if (elapsedMs >= 1000 || queryTimedOut) {
        console.info("home_public_data_query_timing", {
          section,
          outcome: "resolved",
          elapsedMs,
          timeoutMs: HOME_QUERY_BUDGET_MS,
          completedAfterTimeout: queryTimedOut,
        })
      }
      return value
    },
    (error) => {
      console.warn("home_public_data_partial", section, {
        outcome: "query_rejected",
        elapsedMs: Date.now() - startedAt,
        timeoutMs: HOME_QUERY_BUDGET_MS,
        completedAfterTimeout: queryTimedOut,
        message: error instanceof Error ? error.message : "query_failed",
      })
      return null
    },
  )

  try {
    return await Promise.race([
      trackedQuery,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          queryTimedOut = true
          console.warn("home_public_data_partial", section, "client_timeout", {
            elapsedMs: Date.now() - startedAt,
            timeoutMs: HOME_QUERY_BUDGET_MS,
          })
          resolve(null)
        }, HOME_QUERY_BUDGET_MS)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function dateValue(value?: string | null) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function numberValue(value?: number | null) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function ascendingNullable(a?: number | null, b?: number | null) {
  const left = a == null ? Number.MAX_SAFE_INTEGER : Number(a)
  const right = b == null ? Number.MAX_SAFE_INTEGER : Number(b)
  return left - right
}

function popularBrandsFromRows(rows: HomeListingRow[]): PopularBrand[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const name = String(row.brand_name ?? "").trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ka"))
    .slice(0, 8)
}

export const getPublicHomePageData = unstable_cache(
  async (): Promise<PublicHomePageData> => {
    const supabase = createPublicServerClient()

    const response = await settleHomeQuery(
      withQueryTimeout(supabase
        .from("listings_catalog")
        .select(HOME_LISTING_SELECT, { count: "estimated" })
        .eq("status", "active")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(HOME_POOL_LIMIT), HOME_QUERY_BUDGET_MS),
      "catalog_pool",
    )

    if (!response || response.error) {
      const message = response?.error?.message ?? "catalog_pool_timeout"
      console.error("home_public_data_unavailable", message)
      throw new Error(`home_public_data_unavailable:${message}`)
    }

    const rows = (response.data ?? []) as unknown as HomeListingRow[]
    const newestFirst = [...rows].sort(
      (a, b) => dateValue(b.published_at) - dateValue(a.published_at),
    )

    const heroItems = rows
      .filter(
        (row) =>
          row.is_featured &&
          row.is_promoted &&
          row.is_vip &&
          Boolean(row.cover_image_url),
      )
      .sort(
        (a, b) =>
          ascendingNullable(a.featured_slot, b.featured_slot) ||
          dateValue(b.published_at) - dateValue(a.published_at),
      )
      .slice(0, 8)

    const vipItems = rows
      .filter((row) => row.is_vip && Boolean(row.cover_image_url))
      .sort(
        (a, b) =>
          numberValue(b.promotion_tier) - numberValue(a.promotion_tier) ||
          dateValue(b.published_at) - dateValue(a.published_at),
      )
      .slice(0, 12)

    const bannerItems = rows
      .filter((row) => row.is_home_banner)
      .sort(
        (a, b) =>
          ascendingNullable(a.home_banner_slot, b.home_banner_slot) ||
          dateValue(b.published_at) - dateValue(a.published_at),
      )
      .slice(0, 4)

    const popularItems = [...rows]
      .sort(
        (a, b) =>
          numberValue(b.favorites_count) - numberValue(a.favorites_count) ||
          numberValue(b.views_count) - numberValue(a.views_count) ||
          dateValue(b.published_at) - dateValue(a.published_at),
      )
      .slice(0, 10)

    const affordableItems = [...rows]
      .sort(
        (a, b) =>
          numberValue(a.price) - numberValue(b.price) ||
          dateValue(b.published_at) - dateValue(a.published_at),
      )
      .slice(0, 10)

    const vintageItems = newestFirst
      .filter((row) => row.category_slug === "vintage")
      .slice(0, 10)

    return {
      heroItems,
      vipItems,
      bannerItems,
      latestItems: newestFirst.slice(0, 10),
      popularItems,
      affordableItems,
      vintageItems,
      popularBrands: popularBrandsFromRows(rows),
      activeCount: response.count ?? rows.length,
    }
  },
  ["home-public-data-v6"],
  {
    revalidate: 60,
    tags: ["home-public-data"],
  },
)
