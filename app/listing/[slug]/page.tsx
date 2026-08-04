import type { Metadata } from "next"
import { notFound } from "next/navigation"
import SiteHeader from "@/components/layout/SiteHeader"
import ListingBreadcrumbs from "@/components/listings/ListingBreadcrumbs"
import ListingGallery from "@/components/listings/ListingGallery"
import ListingOverviewCard from "@/components/listings/ListingOverviewCard"
import RecentlyViewedTracker from "@/components/listings/RecentlyViewedTracker"
import SimilarListingsSection from "@/components/listings/SimilarListingsSection"
import { ka } from "@/lib/i18n/ka"
import {
  fetchListingPageData,
  generateListingMetadata,
  reportMessageLabel,
  safetyMessageLabel,
  type ListingPageQueryParams,
} from "@/lib/listing-page"
import { getUserAvatar } from "@/lib/profiles"
import { absoluteUrl } from "@/lib/seo"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return generateListingMetadata(slug)
}

export default async function ListingDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<ListingPageQueryParams>
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
  } = pageData

  const chatError = typeof query.chatError === "string" ? query.chatError : ""
  const favoriteError =
    query.favorite === "error" ? ka.listingDetail.favoriteFailed : ""
  const reportCode = typeof query.report === "string" ? query.report : ""
  const safetyCode = typeof query.safety === "string" ? query.safety : ""
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

  return (
    <>
      <SiteHeader />
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
              shareUrl={absoluteUrl(`/listing/${listing.slug}`)}
            />
          </div>
        </section>

        <SimilarListingsSection
          listingSlug={listing.slug}
          similarItems={similarItems}
          favoriteIds={favoriteIds}
        />
      </main>
    </>
  )
}
