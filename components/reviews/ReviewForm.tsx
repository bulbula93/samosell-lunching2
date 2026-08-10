import { upsertListingReviewAction } from "@/app/reviews/actions"
import ReviewSubmitButton from "@/components/reviews/ReviewSubmitButton"
import { REVIEW_COMMENT_MAX_LENGTH, reviewCopy } from "@/lib/reviews"
import type { PublicSellerReview } from "@/types/review"

export default function ReviewForm({
  listingId,
  listingSlug,
  existingReview,
}: {
  listingId: string
  listingSlug: string
  existingReview?: PublicSellerReview | null
}) {
  const scoreHintId = `review-score-hint-${listingId}`
  const commentHintId = `review-comment-hint-${listingId}`

  return (
    <form
      action={upsertListingReviewAction}
      className="rounded-[1rem] border border-brand/20 bg-brand-soft/35 p-5 sm:p-6"
    >
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />

      <fieldset aria-describedby={scoreHintId}>
        <legend className="text-base font-black text-text">{reviewCopy.scoreLabel}</legend>
        <p id={scoreHintId} className="mt-1 text-sm leading-6 text-text-soft">
          {reviewCopy.eligibleHint}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <label
              key={score}
              className="relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-white px-3 text-lg text-amber-500 transition hover:border-amber-300 has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2"
            >
              <input
                type="radio"
                name="score"
                value={score}
                defaultChecked={existingReview?.score === score}
                required
                className="sr-only"
              />
              <span aria-hidden="true">★</span>
              <span className="sr-only">{score} ვარსკვლავი</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label htmlFor={`review-comment-${listingId}`} className="block text-sm font-bold text-text">
          {reviewCopy.commentLabel}
        </label>
        <textarea
          id={`review-comment-${listingId}`}
          name="comment"
          rows={4}
          maxLength={REVIEW_COMMENT_MAX_LENGTH}
          defaultValue={existingReview?.comment ?? ""}
          aria-describedby={commentHintId}
          placeholder={reviewCopy.commentPlaceholder}
          className="ui-input mt-2 min-h-28 resize-y"
        />
        <p id={commentHintId} className="mt-1 text-xs leading-5 text-text-soft">
          {reviewCopy.commentHint}
        </p>
      </div>

      <div className="mt-5">
        <ReviewSubmitButton isUpdate={Boolean(existingReview)} />
      </div>
    </form>
  )
}
