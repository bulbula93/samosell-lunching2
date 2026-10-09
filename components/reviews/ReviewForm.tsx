import { upsertListingReviewAction } from "@/app/reviews/actions"
import ReviewSubmitButton from "@/components/reviews/ReviewSubmitButton"
import { REVIEW_COMMENT_MAX_LENGTH, reviewCopy } from "@/lib/reviews"
import type { PublicSellerReview } from "@/types/review"

export default function ReviewForm({
  listingId,
  listingSlug,
  existingReview,
  chatId,
  compact = false,
}: {
  listingId: string
  listingSlug: string
  existingReview?: Pick<PublicSellerReview, "score" | "comment"> | null
  chatId?: string
  compact?: boolean
}) {
  const scoreHintId = `review-score-hint-${listingId}`
  const commentHintId = `review-comment-hint-${listingId}`

  return (
    <form
      action={upsertListingReviewAction}
      className={compact ? "rounded-xl bg-white p-3 sm:p-4" : "rounded-[1rem] border border-brand/20 bg-brand-soft/35 p-5 sm:p-6"}
    >
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />
      {chatId ? <input type="hidden" name="chatId" value={chatId} /> : null}

      <fieldset aria-describedby={scoreHintId}>
        <legend className="text-base font-black text-text">{reviewCopy.scoreLabel}</legend>
        <p id={scoreHintId} className="mt-1 text-sm leading-6 text-text-soft">
          {compact ? "შეაფასე გამყიდველთან ურთიერთობის გამოცდილება." : reviewCopy.eligibleHint}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((score) => (
            <label
              key={score}
              className="relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border border-[#eadbd0] bg-white px-3 text-xl text-amber-500 transition hover:border-amber-400 has-[:checked]:border-[#075a53] has-[:checked]:bg-[#075a53] has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#075a53] has-[:focus-visible]:ring-offset-2"
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
          rows={compact ? 2 : 4}
          maxLength={REVIEW_COMMENT_MAX_LENGTH}
          defaultValue={existingReview?.comment ?? ""}
          aria-describedby={commentHintId}
          placeholder={reviewCopy.commentPlaceholder}
          className={compact ? "ui-input mt-2 min-h-20 resize-y" : "ui-input mt-2 min-h-28 resize-y"}
        />
        <p id={commentHintId} className="mt-1 text-xs leading-5 text-text-soft">
          {compact ? "არასავალდებულო" : reviewCopy.commentHint}
        </p>
      </div>

      <div className="mt-5">
        <ReviewSubmitButton isUpdate={Boolean(existingReview)} />
      </div>
    </form>
  )
}
