import Link from "next/link"
import FavoriteToggleForm from "@/components/favorites/FavoriteToggleForm"
import SmartImage from "@/components/shared/SmartImage"
import { conditionLabel, relativePublishedLabel } from "@/lib/listings"
import type { CatalogListing } from "@/types/marketplace"

type CatalogLandingCardProps = {
  item: CatalogListing
  currentPath?: string
  isFavorited?: boolean
  sellerItemCount?: number
}

function formatPrice(item: CatalogListing) {
  const price = Number.isFinite(item.price) ? item.price : 0
  const formatted = new Intl.NumberFormat("ka-GE", { maximumFractionDigits: 0 }).format(price)
  return item.currency === "GEL" ? `${formatted} ₾` : `${formatted} ${item.currency}`
}

function formatPreviousPrice(price: number, currency: string) {
  const formatted = new Intl.NumberFormat("ka-GE", { maximumFractionDigits: 0 }).format(Math.round(price * 1.28))
  return currency === "GEL" ? `${formatted} ₾` : `${formatted} ${currency}`
}

function sellerLabel(item: CatalogListing) {
  return item.seller_username ? `@${item.seller_username}` : item.seller_full_name ?? "Nickname"
}

function StarRow() {
  return (
    <div className="flex items-center gap-0.5 text-[#F88A51]" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <svg key={index} viewBox="0 0 24 24" fill={index < 4 ? "currentColor" : "none"} className="h-[11px] w-[11px] stroke-current stroke-[1.6]">
          <path d="M12 3.75L14.6238 8.77735L20.1737 9.53896L16.0868 13.3864L17.0517 18.846L12 16.3375L6.94835 18.846L7.91325 13.3864L3.82631 9.53896L9.37618 8.77735L12 3.75Z" />
        </svg>
      ))}
    </div>
  )
}

export default function CatalogLandingCard({ item, currentPath = "/catalog", isFavorited = false, sellerItemCount = 0 }: CatalogLandingCardProps) {
  const sellerHref = item.seller_username ? `/seller/${item.seller_username}` : null
  const hasPromotion = Boolean(item.is_vip || item.is_promoted || item.is_featured)
  const publishedLabel = relativePublishedLabel(item.published_at)

  return (
    <article className="group flex h-full flex-col gap-2.5">
      <div className="relative overflow-hidden rounded-[8px] bg-[#E8E8E8] transition duration-200 group-hover:border-[2px] group-hover:border-[#F88A51] group-hover:shadow-[0_4px_4px_rgba(0,0,0,0.32)]">
        <Link href={`/listing/${item.slug}`} className="block aspect-[0.95] bg-[#E8E8E8]">
          <SmartImage
            src={item.cover_image_url}
            alt={item.title}
            wrapperClassName="h-full w-full"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            fallbackLabel="სურათი მალე დაემატება"
          />
        </Link>

        <div className="absolute bottom-2 right-2">
          <FavoriteToggleForm
            listingId={item.id}
            listingSlug={item.slug}
            nextPath={currentPath}
            isFavorited={isFavorited}
            compact
            className="!h-8 !w-8"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-0.5">
        <div className="flex items-center justify-between gap-2 text-[14px] leading-5">
          <div className="min-w-0 truncate text-[14px] font-medium leading-5 text-[#2D2D2D]">{sellerLabel(item)}</div>
          {sellerHref ? (
            <Link href={sellerHref} className="shrink-0 text-[12px] font-bold leading-5 text-[#F88A51] underline underline-offset-2">
              {sellerItemCount > 0 ? `${sellerItemCount} ნივთი` : "პროფილი"}
            </Link>
          ) : (
            <span className="shrink-0 text-[12px] font-bold leading-5 text-[#F88A51] underline underline-offset-2">{publishedLabel || "ახალი"}</span>
          )}
        </div>

        <StarRow />

        <Link href={`/listing/${item.slug}`} className="block">
          <h3 className="line-clamp-1 text-[14px] font-normal uppercase leading-5 text-[#2D2D2D] transition group-hover:text-[#F88A51]">
            {item.title}
          </h3>
        </Link>

        <div className="text-[14px] font-normal leading-[18px] text-[#2D2D2D]">{item.size_label ? `ზომა ${item.size_label}` : conditionLabel(item.condition)}</div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[20px] font-semibold leading-8 text-[#212832]">{formatPrice(item)}</span>
              {hasPromotion ? <span className="text-[16px] font-normal leading-8 text-[rgba(30,30,30,0.6)] line-through">{formatPreviousPrice(item.price, item.currency)}</span> : null}
            </div>
          </div>

          {hasPromotion ? (
            <span className="inline-flex h-[30px] shrink-0 items-center justify-center rounded-full bg-[rgba(253,155,27,0.8)] px-3 text-[13px] font-medium leading-5 text-white">
              -10%
            </span>
          ) : (
            <span className="text-[12px] text-[#616161]">{item.color || item.city || publishedLabel || ""}</span>
          )}
        </div>
      </div>
    </article>
  )
}
