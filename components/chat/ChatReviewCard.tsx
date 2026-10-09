import ReviewForm from "@/components/reviews/ReviewForm"
import { reviewFeedbackMessage } from "@/lib/reviews"

type ChatReviewCardProps = {
  listingId: string
  listingSlug: string
  chatId: string
  existingReview: { score: number; comment: string | null } | null
  feedbackCode?: string
}

export default function ChatReviewCard({
  listingId,
  listingSlug,
  chatId,
  existingReview,
  feedbackCode,
}: ChatReviewCardProps) {
  const feedback = reviewFeedbackMessage(feedbackCode)
  const isError = Boolean(feedbackCode && feedbackCode !== "saved")

  return (
    <aside aria-label="გამყიდველის შეფასება" className="mx-auto w-full max-w-3xl px-3 py-2 sm:px-5">
      {feedback ? (
        <p role={isError ? "alert" : "status"} className={`mb-2 rounded-xl px-3 py-2 text-xs font-semibold ${isError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-900"}`}>
          {feedback}
        </p>
      ) : null}
      <details key={existingReview?.score ?? "new"} open={Boolean(feedback && isError)} className="group rounded-2xl border border-[#e6e9e4] bg-[#f7faf8]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#073f3b] [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-[#d77a00]">★</span>
            {existingReview ? `შენი შეფასება: ${existingReview.score}/5` : "როგორი იყო გამყიდველთან ურთიერთობა?"}
          </span>
          <span className="shrink-0 text-xs text-[#075a53] group-open:hidden">{existingReview ? "შეცვლა" : "შეფასება"}</span>
          <span className="hidden shrink-0 text-xs text-[#075a53] group-open:block">დახურვა</span>
        </summary>
        <div className="max-h-[42dvh] overflow-y-auto border-t border-[#e6e9e4] p-2">
          <ReviewForm listingId={listingId} listingSlug={listingSlug} chatId={chatId} existingReview={existingReview} compact />
        </div>
      </details>
    </aside>
  )
}
