import ReviewList from "@/components/reviews/ReviewList"
import ReviewSummary from "@/components/reviews/ReviewSummary"
import { reviewCopy } from "@/lib/reviews"
import type { SellerReviewData } from "@/types/review"

export default function SellerReviewsSection({ data }: { data: SellerReviewData }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6" aria-labelledby="seller-reviews-heading">
      <div className="ui-card p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">რეპუტაცია</p>
            <h2 id="seller-reviews-heading" className="mt-2 text-2xl font-black text-text sm:text-3xl">
              {reviewCopy.sellerHeading}
            </h2>
          </div>
          <ReviewSummary summary={data.summary} />
        </div>

        {data.reviews.length > 0 ? (
          <div className="mt-6">
            <ReviewList reviews={data.reviews} />
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-line bg-surface-alt px-5 py-6 text-sm text-text-soft">
            {reviewCopy.empty}
          </p>
        )}
      </div>
    </section>
  )
}
