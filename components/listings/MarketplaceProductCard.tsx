import PromotionExpiry from "@/components/shared/PromotionExpiry"
import Link from "next/link"
import FavoriteToggleForm from "@/components/favorites/FavoriteToggleForm"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import { ka } from "@/lib/i18n/ka"
import { conditionLabel, listingPriceLabel } from "@/lib/listings"
import { searchListingHref } from "@/lib/search-analytics"
import type { CatalogListing } from "@/types/marketplace"

type MarketplaceProductCardProps = {
  item: CatalogListing
  currentPath?: string
  isFavorited?: boolean
  showFavorite?: boolean
  searchId?: string | null
  imageLoading?: "eager" | "lazy"
}

function statusLabel(status?: string | null) {
  if (status === "reserved") return ka.product.reserved
  if (status === "sold") return ka.product.sold
  return ""
}

function promotionLabel(item: CatalogListing) {
  if (item.is_featured) return "VIP MAX"
  if (item.is_promoted) return "TOP"
  if (item.is_vip) return ka.product.vip
  return ""
}

function promotionClass(item: CatalogListing) {
  if (item.is_featured) return "bg-accent text-brand"
  if (item.is_promoted) return "bg-brand text-white"
  return "bg-[#fff4df] text-brand"
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  )
}

function SellerArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 fill-none stroke-current"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export default function MarketplaceProductCard({
  item,
  currentPath = "/catalog",
  isFavorited = false,
  showFavorite = true,
  searchId = null,
  imageLoading = "lazy",
}: MarketplaceProductCardProps) {
  const unavailable = item.status === "reserved" || item.status === "sold"
  const statusBadge = statusLabel(item.status)
  const promotionBadge = !statusBadge ? promotionLabel(item) : ""
  const sellerLabel = item.seller_full_name || item.seller_username || "გამყიდველი"
  const sellerAvatar = item.seller_type === "store"
    ? item.seller_store_logo_url || item.seller_avatar_url
    : item.seller_avatar_url
  const sellerHref = item.seller_username
    ? `/seller/${encodeURIComponent(item.seller_username)}`
    : null
  const listingHref = searchListingHref(item.slug, searchId)
  const priceLabel = listingPriceLabel(item.price, item.currency, item.sale_type)
  const isGift = item.sale_type === "gift"
  const locationLabel = item.city || ka.product.locationUnknown

  const sellerIdentity = (
    <>
      <Avatar
        src={sellerAvatar}
        alt={sellerLabel}
        fallbackText={sellerLabel}
        sizeClassName="h-8 w-8"
        textClassName="text-[10px]"
        className="shrink-0 border border-line/80 shadow-none ring-0"
      />
      <span className="min-w-0 flex-1 truncate font-bold text-text">{sellerLabel}</span>
      {item.seller_is_verified ? (
        <span
          title="დადასტურებული გამყიდველი"
          aria-label="დადასტურებული გამყიდველი"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white"
        >
          ✓
        </span>
      ) : null}
    </>
  )

  return (
    <article className="group relative flex h-full min-w-0 flex-col rounded-[22px] border border-[#e7eeeb] bg-white p-2 shadow-[0_8px_26px_rgba(7,63,59,0.055)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_16px_36px_rgba(7,63,59,0.1)] sm:rounded-[24px] sm:p-2.5 [contain-intrinsic-size:auto_340px] [content-visibility:auto]">
      <Link
        data-catalog-open=""
        href={listingHref}
        prefetch={false}
        aria-label={`${item.title} — ${priceLabel}`}
        className="absolute inset-0 z-10 rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:rounded-[22px]"
      >
        <span className="sr-only">{item.title}</span>
      </Link>

      <div className="relative aspect-[4/5] overflow-hidden rounded-[19px] bg-[#f5f5f4] sm:rounded-[20px]">
        <SmartImage
          src={item.cover_image_url}
          alt={item.title}
          wrapperClassName="h-full w-full"
          className={`transition duration-300 group-hover:scale-[1.025] ${unavailable ? "grayscale-[30%]" : ""}`}
          fit="auto"
          frameAspect={4 / 5}
          backdrop
          fallbackLabel={ka.product.imageUnavailable}
          loading={imageLoading}
          sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
        />

        {(isGift || statusBadge || promotionBadge) ? (
          <div className="pointer-events-none absolute left-2 top-2 z-20 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-1.5 sm:left-2.5 sm:top-2.5">
            {isGift ? (
              <span className="inline-flex min-h-7 items-center rounded-full border border-[#ffd5b2] bg-[#fff7ed]/95 px-2.5 py-1 text-[11px] font-black text-[#d85f0e] shadow-sm backdrop-blur">
                🎁 ჩუქება
              </span>
            ) : null}
            {statusBadge || promotionBadge ? (
              <PromotionExpiry until={statusBadge ? "9999-01-01T00:00:00Z" : item.is_featured ? item.featured_until : item.is_promoted ? item.promoted_until : item.vip_until}>
              <span
                className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-[11px] font-black shadow-sm backdrop-blur ${
                  statusBadge ? "bg-text text-white" : promotionClass(item)
                }`}
              >
                {statusBadge || promotionBadge}
              </span>
              </PromotionExpiry>
            ) : null}
          </div>
        ) : null}

        {showFavorite && !unavailable ? (
          <div className="absolute right-2 top-2 z-30 sm:right-2.5 sm:top-2.5">
            <FavoriteToggleForm
              listingId={item.id}
              listingSlug={item.slug}
              nextPath={currentPath}
              isFavorited={isFavorited}
              searchId={searchId}
              compact
              className="shadow-[0_5px_16px_rgba(7,63,59,0.12)]"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3 sm:px-2 sm:pt-3.5">
        <h3 className="line-clamp-2 min-h-10 text-[14px] font-bold leading-5 text-text transition group-hover:text-brand sm:text-sm">
          {item.title}
        </h3>

        <div className={`mt-1.5 flex items-center gap-1.5 text-[19px] font-black leading-7 sm:text-xl ${isGift ? "text-[#e96b10]" : "text-brand"}`}>
          {isGift ? <span aria-hidden="true" className="text-[15px]">🎁</span> : null}
          <span>{priceLabel}</span>
        </div>

        {/* Wrap instead of truncating: on 2-column phones "ახალი"/"თბილისი" used to become "ასა…"/"თბილ…". */}
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-medium text-text-soft sm:text-xs" data-card-meta>
          <span className="max-w-full rounded-full bg-[#eff3f1] px-2.5 py-1 sm:px-3">
            {conditionLabel(item.condition)}
          </span>
          <span className="flex max-w-full items-center gap-1 rounded-full bg-[#eff3f1] px-2.5 py-1 sm:px-3">
            <LocationIcon />
            <span className="break-words">{locationLabel}</span>
          </span>
        </div>

        <div className="mt-3 border-t border-line/75 pt-2.5 sm:mt-3.5 sm:pt-3">
          {sellerHref ? (
            <Link
              href={sellerHref}
              prefetch={false}
              aria-label={`${sellerLabel} — გამყიდველის გვერდი`}
              className="group/seller relative z-20 -mx-1 flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1.5 text-[11px] sm:text-xs text-text-soft transition hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
            >
              {sellerIdentity}
              <span className="shrink-0 text-text-soft transition group-hover/seller:translate-x-0.5 group-hover/seller:text-brand">
                <SellerArrowIcon />
              </span>
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-2 px-0.5 py-1 text-[11px] text-text-soft sm:text-xs">
              {sellerIdentity}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export function MarketplaceProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="min-w-0 rounded-[20px] border border-line bg-white p-2 sm:rounded-[22px] sm:p-2.5">
      <div className="ui-skeleton aspect-[4/5] w-full rounded-[15px] sm:rounded-[16px]" />
      <div className="ui-skeleton mt-3 h-4 w-4/5" />
      <div className="ui-skeleton mt-2 h-5 w-2/5" />
      <div className="ui-skeleton mt-2 h-5 w-3/5" />
      <div className="ui-skeleton mt-3 h-7 w-full rounded-xl" />
    </div>
  )
}
