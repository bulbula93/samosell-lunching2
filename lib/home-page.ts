import "server-only"

import { unstable_cache } from "next/cache"
import type { User } from "@supabase/supabase-js"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { PUBLIC_QUERY_TIMEOUT_MS, withQueryTimeout } from "@/lib/supabase/query-timeout"
import { guardPublicLoad } from "@/lib/public-load-guard"
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
  "vip_until",
  "promoted_until",
  "featured_until",
  "home_banner_until",
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
const HOME_POOL_LIMIT = 500

async function settleHomeQuery<T>(
  query: PromiseLike<T>,
  section: string,
  timeoutMs: number,
): Promise<T | null> {
  const startedAt = Date.now()
  try {
    const value = await query
    const elapsedMs = Date.now() - startedAt
    if (elapsedMs >= 1000) {
      console.info("home_public_data_query_timing", {
        section, outcome: "resolved", elapsedMs, timeoutMs,
        completedAfterTimeout: elapsedMs >= timeoutMs,
      })
    }
    return value
  } catch {
    console.warn("home_public_data_partial", section, {
      outcome: "query_rejected", elapsedMs: Date.now() - startedAt, timeoutMs,
    })
    return null
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

const getCachedPublicHomePageData = unstable_cache(
  guardPublicLoad(async (): Promise<PublicHomePageData> => {
    const deadline = Date.now() + HOME_QUERY_BUDGET_MS
    const supabase = createPublicServerClient()

    const response = await settleHomeQuery(
      withQueryTimeout(supabase
        .from("listings_catalog")
        .select(HOME_LISTING_SELECT, { count: "exact" })
        .eq("status", "active")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(HOME_POOL_LIMIT), HOME_QUERY_BUDGET_MS),
      "catalog_pool",
      HOME_QUERY_BUDGET_MS,
    )

    // A timeout/cancellation must not immediately double upstream work. Only a
    // fast transient server failure may retry, within the ORIGINAL total budget.
    let recovered: typeof response = null
    // A rejected transport has no verified retryable HTTP response. In
    // particular, settleHomeQuery returns null for an AbortError; retrying it
    // would start fresh work after cancellation.
    if (!response) {
      throw new Error("home_public_data_unavailable:catalog_pool_failed")
    }
    if (response.error) {
      const remainingMs = deadline - Date.now()
      const cancelled = /abort|timeout|cancel/i.test(response?.error?.message ?? "")
        || response?.error?.code === "57014"
      const retryableServerFailure = response.status >= 500 && response.status < 600
      if (remainingMs < 1000 || cancelled || !retryableServerFailure) {
        throw new Error("home_public_data_unavailable:catalog_pool_failed")
      }
      const retryBudgetMs = Math.min(6000, remainingMs)
      console.warn("home_public_data_retry", {
        reason: response?.error?.message ?? "catalog_pool_timeout",
      })
      recovered = await settleHomeQuery(
        withQueryTimeout(supabase
          .from("listings_catalog")
          .select(HOME_LISTING_SELECT)
          .eq("status", "active")
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(HOME_POOL_LIMIT), retryBudgetMs),
        "catalog_pool_retry",
        retryBudgetMs,
      ) as typeof response
    }

    const usable = response && !response.error ? response :
      recovered && !recovered.error ? recovered : null
    if (!usable) {
      const message = recovered?.error?.message ?? response?.error?.message ?? "catalog_pool_timeout"
      console.warn("home_public_data_unavailable", message)
      // Throw only within the cache loader: Next can retain a previous cache
      // value, while the route renders a non-cached degradation state on a miss.
      throw new Error(`home_public_data_unavailable:${message}`)
    }

    const rows = (usable.data ?? []) as unknown as HomeListingRow[]
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
      activeCount: usable.count ?? rows.length,
    }
  }),
  ["home-public-data-v6"],
  {
    revalidate: 60,
    tags: ["home-public-data"],
  },
)

function refreshPromotion<T extends CatalogListing>(item: T, now: number): T {
  const active = (value?: string | null) => Boolean(value && Date.parse(value) > now)
  const is_vip = item.is_vip && active(item.vip_until)
  const is_promoted = Boolean(item.is_promoted && active(item.promoted_until))
  const is_featured = Boolean(item.is_featured && active(item.featured_until))
  const is_home_banner = Boolean(item.is_home_banner && active(item.home_banner_until))
  return { ...item, is_vip, is_promoted, is_featured, is_home_banner,
    promotion_tier: is_featured ? 3 : is_promoted ? 2 : is_vip ? 1 : 0 }
}

/** Expiry is checked on every render, including when Next serves stale data after an outage. */
export async function getPublicHomePageData(): Promise<PublicHomePageData> {
  const data = await getCachedPublicHomePageData()
  const now = Date.now()
  const refresh = (items: CatalogListing[]) => items.map((item) => refreshPromotion(item, now))
  return {
    ...data,
    heroItems: refresh(data.heroItems).filter((item) => item.is_vip && item.is_promoted && item.is_featured),
    vipItems: refresh(data.vipItems).filter((item) => item.is_vip).sort((a, b) =>
      numberValue(b.promotion_tier) - numberValue(a.promotion_tier) ||
      dateValue(b.published_at) - dateValue(a.published_at)),
    bannerItems: refresh(data.bannerItems).filter((item) => item.is_home_banner),
    latestItems: refresh(data.latestItems),
    popularItems: refresh(data.popularItems),
    affordableItems: refresh(data.affordableItems),
    vintageItems: refresh(data.vintageItems),
  }
}
