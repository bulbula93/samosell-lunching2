import { describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchPublicSellerMetrics } from "@/lib/public-seller-metrics"

function client(active: unknown, sold: unknown, score: unknown, reviews: unknown, error: unknown = null) {
  const eq = vi.fn(() => ({ maybeSingle: async () => ({ data: { review_count: reviews, average_score: score }, error }) }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  const rpc = vi.fn(() => ({ maybeSingle: async () => ({ data: { active_count: active, sold_count: sold }, error: null }) }))
  return { supabase: { from, rpc } as unknown as SupabaseClient, from, rpc, select, eq }
}

describe("public seller metrics", () => {
  it("uses only narrow public aggregates scoped to the requested seller", async () => {
    const c = client("12", "3", "4.67", 3)
    expect(await fetchPublicSellerMetrics(c.supabase, "seller-A")).toEqual({ activeCount: 12, soldCount: 3, reviewSummary: { reviewCount: 3, averageScore: 4.67 } })
    expect(c.rpc).toHaveBeenCalledExactlyOnceWith("get_public_seller_listing_counts", { p_seller_id: "seller-A" })
    expect(c.from).toHaveBeenCalledExactlyOnceWith("seller_review_summaries")
    expect(c.select).toHaveBeenCalledExactlyOnceWith("review_count, average_score")
    expect(c.eq).toHaveBeenCalledExactlyOnceWith("seller_id", "seller-A")
  })
  it("never turns a missing or invalid rating into a score", async () => {
    for (const score of [null, undefined, "invalid", 0, 6]) {
      const c = client(0, 0, score, 0)
      expect((await fetchPublicSellerMetrics(c.supabase, "new-seller")).reviewSummary.averageScore).toBeNull()
    }
  })
  it("propagates query errors instead of presenting fake zero statistics", async () => {
    const c = client(12, 3, 5, 1, { message: "unavailable" })
    await expect(fetchPublicSellerMetrics(c.supabase, "seller-A")).rejects.toThrow("SELLER_TRUST_STATS_FAILED")
  })
})
