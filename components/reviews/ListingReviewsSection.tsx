import ReviewForm from "@/components/reviews/ReviewForm"
import ReviewList from "@/components/reviews/ReviewList"
import ReviewSummary from "@/components/reviews/ReviewSummary"
import { reviewCopy, reviewFeedbackMessage } from "@/lib/reviews"
import type { PublicSellerReview, SellerReviewSummary } from "@/types/review"

export default function ListingReviewsSection({
  listingId,
  listingSlug,
  summary,
  reviews,
  canReview,
  viewerId,
  feedbackCode,
}: {
  listingId: string
  listingSlug: string
  summary: SellerReviewSummary
  reviews: PublicSellerReview[]
  canReview: boolean
  viewerId?: string | null
  feedbackCode?: string
}) {
  const existingReview = reviews.find((review) => review.reviewerId === viewerId) ?? null
  const feedback = reviewFeedbackMessage(feedbackCode)
  const feedbackIsError = Boolean(feedbackCode && feedbackCode !== "saved")

  return (
    <section className="ui-container pb-12 sm:pb-16" aria-labelledby="listing-reviews-heading">
      <div className="ui-card p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">SAMOSELL</p>
            <h2 id="listing-reviews-heading" className="mt-2 text-2xl font-black text-text">
              {reviewCopy.heading}
            </h2>
          </div>
          <ReviewSummary summary={summary} />
        </div>

        {feedback ? (
          <p
            role={feedbackIsError ? "alert" : "status"}
            aria-live="polite"
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
              feedbackIsError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {feedback}
          </p>
        ) : null}

        {canReview ? (
          <div className="mt-6">
            <ReviewForm
              listingId={listingId}
              listingSlug={listingSlug}
              existingReview={existingReview}
            />
          </div>
        ) : null}

        {reviews.length > 0 ? (
          <div className="mt-6">
            <ReviewList reviews={reviews} />
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-line bg-surface-alt px-5 py-6 text-sm text-text-soft">
            {reviewCopy.listingEmpty}
          </p>
        )}
      </div>
    </section>
  )
}
