import type { SupabaseClient } from "@supabase/supabase-js"
import type { SellerReviewSummary } from "@/types/review"

export type PublicSellerMetrics = {
  activeCount: number
  soldCount: number
  reviewSummary: SellerReviewSummary
}

function count(value: unknown) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : 0
}

// Reuse the existing narrow public aggregates. Never read order rows or private
// profile fields to build a trust card. Sold means listings.status = 'sold'.
export async function fetchPublicSellerMetrics(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<PublicSellerMetrics> {
  const [listings, reviews] = await Promise.all([
    supabase.rpc("get_public_seller_listing_counts", { p_seller_id: sellerId }).maybeSingle(),
    supabase.from("seller_review_summaries").select("review_count, average_score").eq("seller_id", sellerId).maybeSingle(),
  ])
  if (listings.error || reviews.error) {
    throw new Error("SELLER_TRUST_STATS_FAILED", { cause: listings.error || reviews.error })
  }
  const reviewCount = count(reviews.data?.review_count)
  const listingCounts = listings.data as { active_count?: unknown; sold_count?: unknown } | null
  const score = reviews.data?.average_score == null ? null : Number(reviews.data.average_score)
  return {
    activeCount: count(listingCounts?.active_count),
    soldCount: count(listingCounts?.sold_count),
    reviewSummary: {
      reviewCount,
      averageScore: reviewCount > 0 && score != null && Number.isFinite(score) && score >= 1 && score <= 5 ? score : null,
    },
  }
}
