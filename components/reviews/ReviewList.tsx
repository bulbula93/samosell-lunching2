import Link from "next/link"
import ReviewStars from "@/components/reviews/ReviewStars"
import Avatar from "@/components/shared/Avatar"
import { formatReviewDate } from "@/lib/reviews"
import type { PublicSellerReview } from "@/types/review"

export default function ReviewList({ reviews }: { reviews: PublicSellerReview[] }) {
  return (
    <ul className="grid gap-4" aria-label="მყიდველების შეფასებები">
      {reviews.map((review) => {
        const reviewer = (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              src={review.reviewerAvatarUrl}
              alt={review.reviewerName}
              fallbackText={review.reviewerName}
              sizeClassName="h-11 w-11"
              textClassName="text-sm"
              className="shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-text">{review.reviewerName}</p>
              <p className="text-xs text-text-soft">{formatReviewDate(review.createdAt)}</p>
            </div>
          </div>
        )

        return (
          <li key={review.id} className="rounded-[1rem] border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {review.reviewerUsername ? (
                <Link
                  href={`/seller/${encodeURIComponent(review.reviewerUsername)}`}
                  className="rounded-xl transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {reviewer}
                </Link>
              ) : reviewer}
              <ReviewStars
                score={review.score}
                label={`${review.score} ვარსკვლავი 5-დან`}
              />
            </div>
            {review.comment ? (
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-text-soft [overflow-wrap:anywhere]">
                {review.comment}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
