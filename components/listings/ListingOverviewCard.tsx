import Link from "next/link"
import StartChatButton from "@/components/chat/StartChatButton"
import FavoriteToggleForm from "@/components/favorites/FavoriteToggleForm"
import ListingSafetyActions from "@/components/moderation/ListingSafetyActions"
import ReviewSummary from "@/components/reviews/ReviewSummary"
import SellerTrustBadges from "@/components/sellers/SellerTrustBadges"
import Avatar from "@/components/shared/Avatar"
import ShareButton from "@/components/shared/ShareButton"
import { ka } from "@/lib/i18n/ka"
import {
  conditionLabel,
  formatPrice,
  formatPublishedDate,
  genderLabel,
} from "@/lib/listings"
import {
  formatJoinDate,
  listingDetailStatusLabel,
  type ListingSellerProfile,
} from "@/lib/listing-page"
import { getSellerPhoneHref } from "@/lib/phone"
import { getSellerTrustSignals } from "@/lib/seller-trust"
import type { CatalogListing } from "@/types/marketplace"
import type { SellerReviewSummary } from "@/types/review"

type ListingOverviewCardProps = {
  listing: CatalogListing
  sellerProfile?: ListingSellerProfile | null
  sellerLabel: string
  sellerAvatarSrc: string | null
  sellerActiveListingsCount: number
  isOwner: boolean
  isAuthenticated: boolean
  canChat: boolean
  isFavorited: boolean
  chatError: string
  favoriteError: string
  reportFlash: string
  reportIsError?: boolean
  safetyFlash?: string
  safetyIsError?: boolean
  isBlocked: boolean
  isBlockedBySeller: boolean
  sellerSuspended: boolean
  sellerReviewSummary?: SellerReviewSummary
  shareUrl: string
  searchId?: string | null
}

type DetailItem = {
  label: string
  value: string
}

function statusClasses(status?: string | null) {
  if (status === "sold") return "border-neutral-300 bg-neutral-100 text-neutral-800"
  if (status === "reserved") return "border-amber-200 bg-amber-50 text-amber-900"
  return "border-emerald-200 bg-emerald-50 text-emerald-900"
}

function getStatusMessage(status?: string | null) {
  if (status === "reserved") return ka.listingDetail.reservedMessage
  if (status === "sold") return ka.listingDetail.soldMessage
  return ""
}

function buildDetailItems(listing: CatalogListing) {
  const details: Array<DetailItem | null> = [
    listing.category_name
      ? { label: ka.listingDetail.category, value: listing.category_name }
      : null,
    listing.brand_name
      ? { label: ka.listingDetail.brand, value: listing.brand_name }
      : null,
    listing.size_label
      ? { label: ka.listingDetail.size, value: listing.size_label }
      : null,
    listing.condition
      ? { label: ka.listingDetail.condition, value: conditionLabel(listing.condition) }
      : null,
    listing.color
      ? { label: ka.listingDetail.color, value: listing.color }
      : null,
    listing.material
      ? { label: ka.listingDetail.material, value: listing.material }
      : null,
    listing.gender
      ? { label: ka.listingDetail.section, value: genderLabel(listing.gender) }
      : null,
    listing.city
      ? { label: ka.listingDetail.location, value: listing.city }
      : null,
  ]

  return details.filter((item): item is DetailItem => Boolean(item))
}

export default function ListingOverviewCard({
  listing,
  sellerProfile,
  sellerLabel,
  sellerAvatarSrc,
  sellerActiveListingsCount,
  isOwner,
  isAuthenticated,
  canChat,
  isFavorited,
  chatError,
  favoriteError,
  reportFlash,
  reportIsError = false,
  safetyFlash = "",
  safetyIsError = false,
  isBlocked,
  isBlockedBySeller,
  sellerSuspended,
  sellerReviewSummary,
  shareUrl,
  searchId = null,
}: ListingOverviewCardProps) {
  const isActive = listing.status === "active"
  const statusMessage = getStatusMessage(listing.status)
  const details = buildDetailItems(listing)
  const description = listing.description?.trim() || ""
  const sellerJoinedAt = formatJoinDate(
    sellerProfile?.created_at || listing.seller_created_at,
  )
  const sellerProfileHref = sellerProfile?.username
    ? `/seller/${encodeURIComponent(sellerProfile.username)}`
    : null
  const sellerPhoneHref = getSellerPhoneHref(sellerProfile?.store_phone)
  const listingReturnPath = searchId
    ? `/listing/${listing.slug}?search_id=${encodeURIComponent(searchId)}`
    : `/listing/${listing.slug}`
  const sellerTrustSignals = sellerProfile
    ? getSellerTrustSignals({
        profile: sellerProfile,
        reviewSummary: sellerReviewSummary,
      }).filter((signal) => signal.key !== "reviews")
    : []
  const messagingUnavailable =
    isActive &&
    !isOwner &&
    isAuthenticated &&
    !canChat &&
    (isBlocked || isBlockedBySeller || sellerSuspended)

  return (
    <article
      aria-labelledby="listing-title"
      className="ui-card min-w-0 p-5 sm:p-6 lg:sticky lg:top-28"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1.5 text-xs font-bold ${statusClasses(listing.status)}`}
        >
          {listingDetailStatusLabel(listing.status)}
        </span>
        {listing.is_vip && isActive ? (
          <span className="ui-pill-vip">VIP</span>
        ) : null}
      </div>

      <header className="mt-5">
        {listing.brand_name ? (
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">
            {listing.brand_name}
          </p>
        ) : null}
        <h1
          id="listing-title"
          className="mt-2 break-words text-2xl font-black leading-tight text-text [overflow-wrap:anywhere] sm:text-3xl"
        >
          {listing.title}
        </h1>
        <p className="mt-4 text-3xl font-black tracking-tight text-text sm:text-4xl">
          {formatPrice(listing.price, listing.currency)}
        </p>
      </header>

      {statusMessage ? (
        <p
          role="status"
          className="mt-5 rounded-xl border border-line bg-surface-alt px-4 py-3 text-sm leading-6 text-text-soft"
        >
          {statusMessage}
        </p>
      ) : null}

      {details.length > 0 ? (
        <section aria-labelledby="listing-details-heading" className="mt-7 border-t border-line pt-6">
          <h2 id="listing-details-heading" className="text-lg font-black text-text">
            {ka.listingDetail.details}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
            {details.map((item) => (
              <div key={item.label} className="min-w-0 border-b border-line/70 pb-3">
                <dt className="text-xs font-semibold text-text-soft">{item.label}</dt>
                <dd className="mt-1 break-words text-sm font-bold text-text [overflow-wrap:anywhere]">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {description ? (
        <section aria-labelledby="listing-description-heading" className="mt-7 border-t border-line pt-6">
          <h2 id="listing-description-heading" className="text-lg font-black text-text">
            {ka.listingDetail.description}
          </h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-text-soft [overflow-wrap:anywhere]">
            {description}
          </p>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-soft">
        {listing.published_at ? (
          <span>
            {ka.listingDetail.published}: {formatPublishedDate(listing.published_at)}
          </span>
        ) : null}
        {(listing.views_count ?? 0) > 0 ? (
          <span>
            {listing.views_count} {ka.listingDetail.views}
          </span>
        ) : null}
        {(listing.favorites_count ?? 0) > 0 ? (
          <span>
            {listing.favorites_count} {ka.listingDetail.favorites}
          </span>
        ) : null}
      </div>

      <section aria-labelledby="listing-seller-heading" className="mt-7 border-t border-line pt-6">
        <h2 id="listing-seller-heading" className="text-lg font-black text-text">
          {ka.listingDetail.seller}
        </h2>

        <div className="mt-4 flex min-w-0 items-center gap-3">
          {sellerProfileHref ? (
            <Link
              href={sellerProfileHref}
              aria-label={`${sellerLabel} — ${ka.listingDetail.viewProfile}`}
              className="shrink-0 rounded-full"
            >
              <Avatar
                src={sellerAvatarSrc}
                alt={sellerLabel}
                fallbackText={sellerLabel}
                sizeClassName="h-14 w-14"
                textClassName="text-base"
              />
            </Link>
          ) : (
            <Avatar
              src={sellerAvatarSrc}
              alt={sellerLabel}
              fallbackText={sellerLabel}
              sizeClassName="h-14 w-14"
              textClassName="text-base"
              className="shrink-0"
            />
          )}

          <div className="min-w-0 flex-1">
            {sellerProfileHref ? (
              <Link
                href={sellerProfileHref}
                className="block truncate rounded-md text-base font-black text-text transition hover:text-brand"
              >
                {sellerLabel}
              </Link>
            ) : (
              <p className="truncate text-base font-black text-text">{sellerLabel}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-soft">
              {sellerProfile?.city ? <span>{sellerProfile.city}</span> : null}
              {sellerJoinedAt ? (
                <span>
                  {ka.listingDetail.memberSince}: {sellerJoinedAt}
                </span>
              ) : null}
              {sellerActiveListingsCount > 0 ? (
                <span>
                  {sellerActiveListingsCount} {ka.listingDetail.activeListings}
                </span>
              ) : null}
            </div>
            {sellerReviewSummary && sellerReviewSummary.reviewCount > 0 ? (
              <div className="mt-2">
                <ReviewSummary summary={sellerReviewSummary} compact />
              </div>
            ) : null}
          </div>
        </div>

        <SellerTrustBadges signals={sellerTrustSignals} compact className="mt-3" />

        {sellerProfile?.bio ? (
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-text-soft [overflow-wrap:anywhere]">
            {sellerProfile.bio}
          </p>
        ) : null}

        {sellerPhoneHref ? (
          <a
            href={sellerPhoneHref}
            className="ui-btn-secondary mt-4 min-h-11 w-full text-center"
            aria-label={`${sellerLabel}-სთან ტელეფონით დაკავშირება: ${sellerProfile?.store_phone}`}
          >
            დარეკვა · {sellerProfile?.store_phone}
          </a>
        ) : null}
      </section>

      {!isOwner && listing.seller_id ? (
        <section
          aria-labelledby="listing-safety-heading"
          className="mt-7 border-t border-line pt-6"
        >
          <h2 id="listing-safety-heading" className="text-lg font-black text-text">
            უსაფრთხოება
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            საეჭვო განცხადება ან ქცევა შეგიძლია კონფიდენციალურად გამოგვიგზავნო
          </p>

          {isAuthenticated ? (
            <ListingSafetyActions
              listingId={listing.id}
              listingSlug={listing.slug}
              sellerId={listing.seller_id}
              nextPath={listingReturnPath}
              isBlocked={isBlocked}
            />
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(listingReturnPath)}`}
              className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4"
            >
              უსაფრთხოების მოქმედებებისთვის გაიარე ავტორიზაცია
            </Link>
          )}
        </section>
      ) : null}

      <section aria-label="ნივთის მოქმედებები" className="mt-7 border-t border-line pt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {isOwner ? (
            <Link
              href={`/dashboard/listings/${listing.id}/edit`}
              className="ui-btn-primary w-full text-center"
            >
              {ka.listingDetail.edit}
            </Link>
          ) : null}

          {isActive && !isOwner ? (
            <FavoriteToggleForm
              listingId={listing.id}
              listingSlug={listing.slug}
              nextPath={listingReturnPath}
              isFavorited={isFavorited}
              searchId={searchId}
              className="min-h-11 w-full rounded-xl"
            />
          ) : null}

          <ShareButton
            url={shareUrl}
            title={listing.title}
            text={`${listing.title} — ${formatPrice(listing.price, listing.currency)}`}
            className="min-h-11 w-full"
          />

          {isActive && !isOwner && isAuthenticated && canChat ? (
            <StartChatButton
              listingId={listing.id}
              listingSlug={listing.slug}
              className="ui-btn-primary min-h-12 w-full shadow-md sm:col-span-2"
              label={ka.listingDetail.messageSeller}
            />
          ) : null}

          {isActive && !isOwner && !isAuthenticated ? (
            <Link
              href={`/login?next=${encodeURIComponent(listingReturnPath)}`}
              className="ui-btn-primary w-full text-center sm:col-span-2"
            >
              {ka.listingDetail.loginToMessage}
            </Link>
          ) : null}
        </div>

        {messagingUnavailable ? (
          <p role="status" className="mt-4 text-sm leading-6 text-text-soft">
            {ka.listingDetail.messageUnavailable}
          </p>
        ) : null}
      </section>

      {chatError ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {chatError}
        </p>
      ) : null}
      {favoriteError ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {favoriteError}
        </p>
      ) : null}
      {reportFlash ? (
        <p
          role={reportIsError ? "alert" : "status"}
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            reportIsError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {reportFlash}
        </p>
      ) : null}
      {safetyFlash ? (
        <p
          role={safetyIsError ? "alert" : "status"}
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            safetyIsError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {safetyFlash}
        </p>
      ) : null}
    </article>
  )
}
