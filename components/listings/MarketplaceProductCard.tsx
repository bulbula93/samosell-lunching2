import Link from "next/link"
import FavoriteToggleForm from "@/components/favorites/FavoriteToggleForm"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import { ka } from "@/lib/i18n/ka"
import { conditionLabel, formatPrice } from "@/lib/listings"
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

export default function MarketplaceProductCard({
  item,
  currentPath = "/catalog",
  isFavorited = false,
  showFavorite = true,
  searchId = null,
  imageLoading = "lazy",
}: MarketplaceProductCardProps) {
  const unavailable = item.status === "reserved" || item.status === "sold"
  const badge = statusLabel(item.status)
  const sellerLabel = item.seller_full_name || item.seller_username || "გამყიდველი"
  const sellerAvatar = item.seller_type === "store"
    ? item.seller_store_logo_url || item.seller_avatar_url
    : item.seller_avatar_url
  const listingHref = searchListingHref(item.slug, searchId)

  return (
    <article className="group relative flex h-full min-w-0 flex-col [contain-intrinsic-size:auto_360px] [content-visibility:auto]">
      <Link
        href={listingHref}
        aria-label={`${item.title} — ${formatPrice(item.price, item.currency)}`}
        className="absolute inset-0 z-10 rounded-2xl"
      >
        <span className="sr-only">{item.title}</span>
      </Link>

      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-surface-alt">
        <SmartImage
          src={item.cover_image_url}
          alt={item.title}
          wrapperClassName="h-full w-full"
          className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.025] ${unavailable ? "grayscale-[30%]" : ""}`}
          fallbackLabel={ka.product.imageUnavailable}
          loading={imageLoading}
          sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, 20vw"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {badge ? (
              <span className="rounded-lg bg-text px-2.5 py-1 text-[11px] font-bold text-white">
                {badge}
              </span>
            ) : null}
            {!badge && item.is_featured ? (
              <span className="rounded-lg bg-[#073f3b] px-2.5 py-1 text-[11px] font-black text-[#f6d98e]">
                VIP MAX
              </span>
            ) : null}
            {!badge && !item.is_featured && item.is_promoted ? (
              <span className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold text-white">
                TOP
              </span>
            ) : null}
            {!badge && !item.is_featured && !item.is_promoted && item.is_vip ? (
              <span className="rounded-lg bg-[#F1C75B] px-2.5 py-1 text-[11px] font-black text-[#3D3108]">
                {ka.product.vip}
              </span>
            ) : null}
          </div>
        </div>

        {showFavorite && !unavailable ? (
          <div className="absolute bottom-2.5 right-2.5 z-30">
            <FavoriteToggleForm
              listingId={item.id}
              listingSlug={item.slug}
              nextPath={currentPath}
              isFavorited={isFavorited}
              searchId={searchId}
              compact
              className="shadow-[0_6px_18px_rgba(7,63,59,0.16)]"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <div className="flex items-center gap-2 text-xs text-text-soft">
          {sellerAvatar ? (
            <Avatar
              src={sellerAvatar}
              alt={sellerLabel}
              fallbackText={sellerLabel}
              sizeClassName="h-6 w-6"
              textClassName="text-[8px]"
              className="border border-line shadow-none ring-0"
            />
          ) : null}
          <span className="min-w-0 truncate">{sellerLabel}</span>
          {item.seller_is_verified ? (
            <span title="დადასტურებული გამყიდველი" aria-label="დადასტურებული გამყიდველი" className="font-bold text-brand">
              ✓
            </span>
          ) : null}
        </div>

        <div className="mt-2">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-text transition group-hover:text-brand">
            {item.brand_name ? `${item.brand_name} · ${item.title}` : item.title}
          </h3>
        </div>

        <div className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-soft">
          {item.size_label ? <span>ზომა {item.size_label}</span> : null}
          <span>{conditionLabel(item.condition)}</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <span className="text-base font-black text-text">{formatPrice(item.price, item.currency)}</span>
          <span className="max-w-[46%] truncate text-right text-xs text-text-soft">
            {item.city || ka.product.locationUnknown}
          </span>
        </div>
      </div>
    </article>
  )
}

export function MarketplaceProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="min-w-0">
      <div className="ui-skeleton aspect-[4/5] w-full rounded-2xl" />
      <div className="ui-skeleton mt-3 h-4 w-2/5" />
      <div className="ui-skeleton mt-3 h-5 w-4/5" />
      <div className="ui-skeleton mt-2 h-4 w-3/5" />
      <div className="ui-skeleton mt-4 h-5 w-1/3" />
    </div>
  )
}
