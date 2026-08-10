import ReviewStars from "@/components/reviews/ReviewStars"
import { formatReviewScore, reviewCopy } from "@/lib/reviews"
import type { SellerReviewSummary } from "@/types/review"

export default function ReviewSummary({
  summary,
  compact = false,
}: {
  summary: SellerReviewSummary
  compact?: boolean
}) {
  if (!summary.reviewCount || summary.averageScore === null) return null

  const formattedScore = formatReviewScore(summary.averageScore)

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <ReviewStars
        score={summary.averageScore}
        label={`საშუალო შეფასება ${formattedScore}, 5-დან`}
        sizeClassName={compact ? "text-sm" : "text-lg"}
      />
      <strong className="text-text">{formattedScore}</strong>
      <span className="text-text-soft">
        ({summary.reviewCount} {reviewCopy.reviewsCount})
      </span>
    </div>
  )
}
