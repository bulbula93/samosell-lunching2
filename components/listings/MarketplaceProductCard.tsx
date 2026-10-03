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
  const listingHref = searchListingHref(item.slug, searchId)
  const priceLabel = listingPriceLabel(item.price, item.currency, item.sale_type)
  const locationLabel = item.city || ka.product.locationUnknown

  return (
    <article className="group relative flex h-full min-w-0 flex-col rounded-[20px] border border-line bg-white p-2 shadow-[0_7px_22px_rgba(7,63,59,0.045)] transition duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-[0_16px_36px_rgba(7,63,59,0.09)] sm:rounded-[22px] sm:p-2.5 [contain-intrinsic-size:auto_340px] [content-visibility:auto]">
      <Link
        href={listingHref}
        aria-label={`${item.title} — ${priceLabel}`}
        className="absolute inset-0 z-10 rounded-[20px] sm:rounded-[22px]"
      >
        <span className="sr-only">{item.title}</span>
      </Link>

      <div className="relative aspect-[4/5] overflow-hidden rounded-[15px] bg-[#f1f2ef] sm:rounded-[16px]">
        <SmartImage
          src={item.cover_image_url}
          alt={item.title}
          wrapperClassName="h-full w-full"
          className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.025] ${unavailable ? "grayscale-[30%]" : ""}`}
          fallbackLabel={ka.product.imageUnavailable}
          loading={imageLoading}
          sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
        />

        {(statusBadge || promotionBadge) ? (
          <div className="pointer-events-none absolute left-2 top-2 z-20 sm:left-2.5 sm:top-2.5">
            <span
              className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-[10px] font-black shadow-sm backdrop-blur sm:text-[11px] ${
                statusBadge ? "bg-text text-white" : promotionClass(item)
              }`}
            >
              {statusBadge || promotionBadge}
            </span>
          </div>
        ) : null}

        {showFavorite && !unavailable ? (
          <div className="absolute bottom-2 right-2 z-30 sm:bottom-2.5 sm:right-2.5">
            <FavoriteToggleForm
              listingId={item.id}
              listingSlug={item.slug}
              nextPath={currentPath}
              isFavorited={isFavorited}
              searchId={searchId}
              compact
              className="shadow-[0_6px_18px_rgba(7,63,59,0.14)]"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5 sm:pt-3">
        <h3 className="line-clamp-2 min-h-10 text-[13px] font-bold leading-5 text-text transition group-hover:text-brand sm:text-sm">
          {item.title}
        </h3>

        <div className="mt-1.5 text-[17px] font-black leading-6 text-brand sm:text-lg">
          {priceLabel}
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] font-medium text-text-soft sm:text-xs">
          <span className="min-w-0 truncate rounded-full bg-surface-alt px-2.5 py-1">
            {conditionLabel(item.condition)}
          </span>
          <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-line" />
          <span className="flex min-w-0 items-center gap-1 truncate">
            <LocationIcon />
            <span className="truncate">{locationLabel}</span>
          </span>
        </div>

        <div className="mt-auto flex min-w-0 items-center gap-2 border-t border-line/75 pt-2.5 text-[11px] text-text-soft sm:pt-3 sm:text-xs">
          <Avatar
            src={sellerAvatar}
            alt={sellerLabel}
            fallbackText={sellerLabel}
            sizeClassName="h-6 w-6"
            textClassName="text-[8px]"
            className="shrink-0 border border-line shadow-none ring-0"
          />
          <span className="min-w-0 flex-1 truncate font-semibold text-text-soft">{sellerLabel}</span>
          {item.seller_is_verified ? (
            <span
              title="დადასტურებული გამყიდველი"
              aria-label="დადასტურებული გამყიდველი"
              className="relative z-20 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white"
            >
              ✓
            </span>
          ) : null}
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
      <div className="ui-skeleton mt-3 h-6 w-full" />
    </div>
  )
}
