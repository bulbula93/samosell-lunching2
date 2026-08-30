import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  PublicSellerReview,
  SellerReviewData,
  SellerReviewSummary,
} from "@/types/review"

export const REVIEW_COMMENT_MAX_LENGTH = 1000

export const reviewCopy = {
  heading: "შეფასებები",
  sellerHeading: "მყიდველების შეფასებები",
  empty: "ამ გამყიდველს შეფასება ჯერ არ აქვს.",
  listingEmpty: "ამ ნივთზე შეფასება ჯერ არ არის.",
  scoreLabel: "შეფასება",
  commentLabel: "კომენტარი",
  commentHint: `მაქსიმუმ ${REVIEW_COMMENT_MAX_LENGTH} სიმბოლო. კომენტარი არასავალდებულოა.`,
  commentPlaceholder: "მოკლედ აღწერე შენი გამოცდილება",
  submit: "შეფასების შენახვა",
  update: "შეფასების განახლება",
  pending: "ინახება…",
  eligibleHint: "შეფასება შეგიძლია დატოვო გაყიდვის დასრულების შემდეგ, თუ გამყიდველმა შენ აგირჩია მყიდველად.",
  saved: "შეფასება შენახულია.",
  invalid: "აირჩიე შეფასება 1-დან 5 ვარსკვლავამდე.",
  commentTooLong: `კომენტარი ${REVIEW_COMMENT_MAX_LENGTH} სიმბოლოზე მეტი არ უნდა იყოს.`,
  notAllowed: "ამ განცხადებაზე შეფასების დატოვება შეუძლებელია.",
  failed: "შეფასების შენახვა ვერ მოხერხდა. სცადე თავიდან.",
  reviewsCount: "შეფასება",
} as const

type ReviewRow = {
  id: string
  listing_id: string
  reviewer_id: string
  score: number
  comment: string | null
  created_at: string
  updated_at: string
}

type ReviewerProfile = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

function toFiniteScore(value: unknown) {
  const score = Number(value)
  return Number.isFinite(score) ? score : null
}

export function validateReviewInput(scoreValue: unknown, commentValue: unknown) {
  const score = Number(scoreValue)
  const comment = String(commentValue ?? "").trim()

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return { ok: false as const, error: "invalid" as const }
  }

  if (comment.length > REVIEW_COMMENT_MAX_LENGTH) {
    return { ok: false as const, error: "comment-too-long" as const }
  }

  return { ok: true as const, score, comment }
}

export function reviewErrorCode(message?: string | null) {
  if (message?.includes("invalid_review_score")) return "invalid"
  if (message?.includes("review_comment_too_long")) return "comment-too-long"
  if (message?.includes("review_not_allowed")) return "not-allowed"
  return "error"
}

export function reviewFeedbackMessage(code?: string) {
  if (code === "saved") return reviewCopy.saved
  if (code === "invalid") return reviewCopy.invalid
  if (code === "comment-too-long") return reviewCopy.commentTooLong
  if (code === "not-allowed") return reviewCopy.notAllowed
  if (code === "error") return reviewCopy.failed
  return ""
}

export function formatReviewDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

export function formatReviewScore(value: number) {
  return new Intl.NumberFormat("ka-GE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

export async function fetchSellerReviewData(
  supabase: SupabaseClient,
  sellerId: string,
  options: { listingId?: string; limit?: number } = {},
): Promise<SellerReviewData> {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 24)
  let reviewsQuery = supabase
    .from("listing_reviews")
    .select("id, listing_id, reviewer_id, score, comment, created_at, updated_at")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (options.listingId) {
    reviewsQuery = reviewsQuery.eq("listing_id", options.listingId)
  }

  const [summaryResponse, reviewsResponse] = await Promise.all([
    supabase
      .from("seller_review_summaries")
      .select("review_count, average_score")
      .eq("seller_id", sellerId)
      .maybeSingle(),
    reviewsQuery,
  ])

  if (summaryResponse.error || reviewsResponse.error) {
    throw new Error("SELLER_REVIEWS_QUERY_FAILED", {
      cause: summaryResponse.error || reviewsResponse.error,
    })
  }

  const rows = (reviewsResponse.data ?? []) as ReviewRow[]
  const reviewerIds = [...new Set(rows.map((review) => review.reviewer_id))]
  const profilesResponse = reviewerIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", reviewerIds)
    : { data: [] as ReviewerProfile[], error: null }

  if (profilesResponse.error) {
    throw new Error("REVIEWER_PROFILES_QUERY_FAILED", {
      cause: profilesResponse.error,
    })
  }

  const profiles = new Map(
    ((profilesResponse.data ?? []) as ReviewerProfile[]).map((profile) => [
      profile.id,
      profile,
    ]),
  )
  const summaryRow = summaryResponse.data as {
    review_count?: number | null
    average_score?: number | string | null
  } | null
  const averageScore = toFiniteScore(summaryRow?.average_score)
  const summary: SellerReviewSummary = {
    reviewCount: Number(summaryRow?.review_count ?? 0),
    averageScore,
  }
  const reviews: PublicSellerReview[] = rows.map((review) => {
    const reviewer = profiles.get(review.reviewer_id)
    return {
      id: review.id,
      listingId: review.listing_id,
      reviewerId: review.reviewer_id,
      score: review.score,
      comment: review.comment,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      reviewerUsername: reviewer?.username ?? null,
      reviewerName:
        reviewer?.full_name || reviewer?.username || "SAMOSELL-ის მყიდველი",
      reviewerAvatarUrl: reviewer?.avatar_url ?? null,
    }
  })

  return { summary, reviews }
}
