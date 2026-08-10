export type SellerReviewSummary = {
  reviewCount: number
  averageScore: number | null
}

export type PublicSellerReview = {
  id: string
  listingId: string
  reviewerId: string
  score: number
  comment: string | null
  createdAt: string
  updatedAt: string
  reviewerUsername: string | null
  reviewerName: string
  reviewerAvatarUrl: string | null
}

export type SellerReviewData = {
  summary: SellerReviewSummary
  reviews: PublicSellerReview[]
}
