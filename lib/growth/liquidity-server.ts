import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { growthPeriod } from "@/lib/growth/shared"

export type LiquidityListing = {
  id: string
  title: string
  slug: string | null
  public_id: string | null
  impressions: number
  clicks: number
  detail_views: number
}
export type LiquidityDay = {
  day: string
  impressions: number
  clicks: number
  detail_views: number
}
export type BuyerLiquiditySnapshot = {
  active_listings: number
  impressions: number
  clicks: number
  detail_views: number
  listings_with_impressions: number
  listings_with_views: number
  lifetime_measured_views: number
  top_listings: LiquidityListing[]
  daily: LiquidityDay[]
}

function integer(input: unknown) {
  const value = Number(input)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export async function loadBuyerLiquidity(period: string, now = new Date()) {
  const range = growthPeriod(period, now)
  try {
    const { data, error } = await createAdminClient().rpc("get_buyer_liquidity_snapshot", {
      p_from: range.from,
      p_to: range.to,
    })
    if (error || !data || typeof data !== "object") throw Error(error?.message ?? "liquidity_snapshot_unavailable")
    const row = data as Record<string, unknown>
    const listings = Array.isArray(row.top_listings) ? row.top_listings as Record<string, unknown>[] : []
    const days = Array.isArray(row.daily) ? row.daily as Record<string, unknown>[] : []
    const snapshot: BuyerLiquiditySnapshot = {
      active_listings: integer(row.active_listings),
      impressions: integer(row.impressions),
      clicks: integer(row.clicks),
      detail_views: integer(row.detail_views),
      listings_with_impressions: integer(row.listings_with_impressions),
      listings_with_views: integer(row.listings_with_views),
      lifetime_measured_views: integer(row.lifetime_measured_views),
      top_listings: listings.map(item => ({
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        slug: item.slug == null ? null : String(item.slug),
        public_id: item.public_id == null ? null : String(item.public_id),
        impressions: integer(item.impressions),
        clicks: integer(item.clicks),
        detail_views: integer(item.detail_views),
      })),
      daily: days.map(item => ({
        day: String(item.day ?? ""),
        impressions: integer(item.impressions),
        clicks: integer(item.clicks),
        detail_views: integer(item.detail_views),
      })),
    }
    return { snapshot, error: null, from: range.from, to: range.to }
  } catch (error) {
    console.warn("buyer_liquidity_dashboard_unavailable", error instanceof Error ? error.message : "unknown")
    return { snapshot: null, error: "Buyer Liquidity მონაცემების წაკითხვა დროებით ვერ მოხერხდა.", from: range.from, to: range.to }
  }
}
