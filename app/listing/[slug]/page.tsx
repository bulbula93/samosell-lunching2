import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { after } from "next/server"
import SiteHeader from "@/components/layout/SiteHeader"
import ListingBreadcrumbs from "@/components/listings/ListingBreadcrumbs"
import ListingGallery from "@/components/listings/ListingGallery"
import ListingOverviewCard from "@/components/listings/ListingOverviewCard"
import RecentlyViewedTracker from "@/components/listings/RecentlyViewedTracker"
import SimilarListingsSection from "@/components/listings/SimilarListingsSection"
import ListingReviewsSection from "@/components/reviews/ListingReviewsSection"
import { ka } from "@/lib/i18n/ka"
import {
  fetchListingPageData,
  generateListingMetadata,
  reportMessageLabel,
  safetyMessageLabel,
  type ListingPageQueryParams,
} from "@/lib/listing-page"
import { getUserAvatar } from "@/lib/profiles"
import { normalizeSearchId, recordSearchInteractionSafely } from "@/lib/search-analytics"
import {
  absoluteUrl,
  buildListingStructuredData,
  serializeJsonLd,
} from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"

type ListingDetailsSearchParams = ListingPageQueryParams & {
  search_id?: string | string[]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const metadata = await generateListingMetadata(slug)
  if (!metadata) notFound()
  return metadata
}

export default async function ListingDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<ListingDetailsSearchParams>
}) {
  const { slug } = await params
  const query = (await searchParams) ?? {}
  const pageData = await fetchListingPageData(slug)
  if (!pageData) notFound()

  const {
    listing,
    images,
    sellerProfile,
    sellerActiveListingsCount,
    similarItems,
    favoriteIds,
    isFavorited,
    isAuthenticated,
    isOwner,
    canChat,
    isBlocked,
    isBlockedBySeller,
    canReview,
    viewerId,
    authenticatedUser,
    reviewData,
  } = pageData

  const searchId = normalizeSearchId(
    typeof query.search_id === "string" ? query.search_id : "",
  )

  if (searchId && listing.status === "active") {
    const analyticsClient = await createClient()
    after(() => {
      return recordSearchInteractionSafely(analyticsClient, {
        searchId,
        listingId: listing.id,
        eventType: "click",
      })
    })
  }

  const chatError = typeof query.chatError === "string" ? query.chatError : ""
  const favoriteError =
    query.favorite === "error" ? ka.listingDetail.favoriteFailed : ""
  const reportCode = typeof query.report === "string" ? query.report : ""
  const safetyCode = typeof query.safety === "string" ? query.safety : ""
  const reviewCode = typeof query.review === "string" ? query.review : ""
  const reportFlash = reportMessageLabel(reportCode)
  const safetyFlash = safetyMessageLabel(safetyCode)
  const reportIsError = Boolean(
    reportCode && reportCode !== "ok" && reportCode !== "user-ok",
  )
  const safetyIsError = Boolean(
    safetyCode && safetyCode !== "blocked" && safetyCode !== "unblocked",
  )
  const sellerLabel =
    sellerProfile?.full_name ||
    listing.seller_full_name ||
    listing.seller_username ||
    "გამყიდველი"
  const sellerType = sellerProfile?.seller_type || listing.seller_type || "individual"
  const sellerAvatarSrc =
    sellerType === "store"
      ? sellerProfile?.store_logo_url ||
        listing.seller_store_logo_url ||
        sellerProfile?.avatar_url ||
        listing.seller_avatar_url ||
        null
      : getUserAvatar(sellerProfile) || listing.seller_avatar_url || null
  const structuredData = listing.status === "active"
    ? buildListingStructuredData(
        listing,
        images.map((image) => image.image_url),
      )
    : null

  return (
    <>
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
        />
      ) : null}
      <SiteHeader authenticatedUser={authenticatedUser} />
      <main className="min-h-screen bg-bg text-text">
        {listing.status === "active" ? (
          <RecentlyViewedTracker listingId={listing.id} />
        ) : null}

        <ListingBreadcrumbs listing={listing} />

        <section className="ui-container pb-12 pt-5 sm:pb-16 sm:pt-7 lg:pb-20">
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:gap-10 xl:gap-12">
            <ListingGallery
              title={listing.title}
              coverImageUrl={listing.cover_image_url}
              images={images}
            />

            <ListingOverviewCard
              listing={listing}
              sellerProfile={sellerProfile}
              sellerLabel={sellerLabel}
              sellerAvatarSrc={sellerAvatarSrc}
              sellerActiveListingsCount={sellerActiveListingsCount}
              isOwner={isOwner}
              isAuthenticated={isAuthenticated}
              canChat={canChat}
              isFavorited={isFavorited}
              chatError={chatError}
              favoriteError={favoriteError}
              reportFlash={reportFlash}
              reportIsError={reportIsError}
              safetyFlash={safetyFlash}
              safetyIsError={safetyIsError}
              isBlocked={isBlocked}
              isBlockedBySeller={isBlockedBySeller}
              sellerSuspended={Boolean(sellerProfile?.is_suspended)}
              sellerReviewSummary={reviewData.summary}
              shareUrl={absoluteUrl(`/listing/${listing.slug}`)}
              searchId={searchId}
            />
          </div>
        </section>

        <ListingReviewsSection
          listingId={listing.id}
          listingSlug={listing.slug}
          summary={reviewData.summary}
          reviews={reviewData.reviews}
          canReview={canReview}
          viewerId={viewerId}
          feedbackCode={reviewCode}
        />

        <SimilarListingsSection
          listingSlug={listing.slug}
          similarItems={similarItems}
          favoriteIds={favoriteIds}
        />
      </main>
    </>
  )
}
