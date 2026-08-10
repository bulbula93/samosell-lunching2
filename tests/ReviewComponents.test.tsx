import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import ListingReviewsSection from "@/components/reviews/ListingReviewsSection"
import ReviewSummary from "@/components/reviews/ReviewSummary"
import { reviewCopy } from "@/lib/reviews"
import type { PublicSellerReview } from "@/types/review"

const review: PublicSellerReview = {
  id: "review-1",
  listingId: "listing-1",
  reviewerId: "buyer-1",
  score: 5,
  comment: "ნივთი ზუსტად აღწერილის შესაბამისი იყო.",
  createdAt: "2026-08-10T10:00:00.000Z",
  updatedAt: "2026-08-10T10:00:00.000Z",
  reviewerUsername: "nino",
  reviewerName: "ნინო",
  reviewerAvatarUrl: null,
}

describe("seller reviews UI", () => {
  it("shows a real aggregate without inventing a rating for empty data", () => {
    const { rerender } = render(
      <ReviewSummary summary={{ reviewCount: 2, averageScore: 4.5 }} />,
    )
    expect(screen.getByLabelText(/საშუალო შეფასება 4.5/)).toBeInTheDocument()
    expect(screen.getByText(/2 შეფასება/)).toBeInTheDocument()

    rerender(<ReviewSummary summary={{ reviewCount: 0, averageScore: null }} />)
    expect(screen.queryByLabelText(/საშუალო შეფასება/)).not.toBeInTheDocument()
  })

  it("renders public review text safely and hides the form when ineligible", () => {
    render(
      <ListingReviewsSection
        listingId="277f3329-6c04-4c40-8f33-873ab3ee4f76"
        listingSlug="linen-jacket"
        summary={{ reviewCount: 1, averageScore: 5 }}
        reviews={[review]}
        canReview={false}
        viewerId={null}
      />,
    )

    expect(screen.getByText(review.comment!)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: reviewCopy.submit })).not.toBeInTheDocument()
  })

  it("shows accessible score controls and pre-fills an eligible buyer review", () => {
    render(
      <ListingReviewsSection
        listingId="277f3329-6c04-4c40-8f33-873ab3ee4f76"
        listingSlug="linen-jacket"
        summary={{ reviewCount: 1, averageScore: 5 }}
        reviews={[review]}
        canReview
        viewerId="buyer-1"
        feedbackCode="saved"
      />,
    )

    expect(screen.getByRole("radio", { name: "5 ვარსკვლავი" })).toBeChecked()
    expect(screen.getByRole("textbox", { name: reviewCopy.commentLabel })).toHaveValue(
      review.comment,
    )
    expect(screen.getByRole("button", { name: reviewCopy.update })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(reviewCopy.saved)
  })
})
