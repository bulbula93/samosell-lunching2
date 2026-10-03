import Link from "next/link"
import FavoriteToggleForm from "@/components/favorites/FavoriteToggleForm"
import SmartImage from "@/components/shared/SmartImage"
import { conditionLabel, listingPriceLabel, relativePublishedLabel } from "@/lib/listings"
import type { CatalogListing } from "@/types/marketplace"

type CatalogLandingCardProps = {
  item: CatalogListing
  currentPath?: string
  isFavorited?: boolean
  sellerItemCount?: number
}

function sellerLabel(item: CatalogListing) {
  return item.seller_username ? `@${item.seller_username}` : item.seller_full_name ?? "Nickname"
}

function StarRow() {
  return (
    <div className="flex items-center gap-0.5 text-[#FF7A00]" aria-hidden="true">
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
  const isGift = item.sale_type === "gift"
  const publishedLabel = relativePublishedLabel(item.published_at)

  return (
    <article className="group flex h-full flex-col gap-2.5">
      <div className="relative overflow-hidden rounded-[8px] bg-[#E8E8E8] transition duration-200 group-hover:border-[2px] group-hover:border-[#FF7A00] group-hover:shadow-[0_4px_4px_rgba(0,0,0,0.32)]">
        <Link href={`/listing/${item.slug}`} className="block aspect-[0.95] bg-[#E8E8E8]">
          <SmartImage
            src={item.cover_image_url}
            alt={item.title}
            wrapperClassName="h-full w-full"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            fallbackLabel="სურათი მალე დაემატება"
          />
        </Link>

        {isGift ? (
          <span className="pointer-events-none absolute left-2 top-2 inline-flex min-h-7 items-center rounded-full border border-[#ffd5b2] bg-[#fff7ed]/95 px-2.5 py-1 text-[10px] font-black text-[#d85f0e] shadow-sm backdrop-blur">
            🎁 ჩუქება
          </span>
        ) : null}

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
            <Link href={sellerHref} className="shrink-0 text-[12px] font-bold leading-5 text-[#FF7A00] underline underline-offset-2">
              {sellerItemCount > 0 ? `${sellerItemCount} ნივთი` : "პროფილი"}
            </Link>
          ) : (
            <span className="shrink-0 text-[12px] font-bold leading-5 text-[#FF7A00] underline underline-offset-2">{publishedLabel || "ახალი"}</span>
          )}
        </div>

        <StarRow />

        <Link href={`/listing/${item.slug}`} className="block">
          <h3 className="line-clamp-1 text-[14px] font-normal uppercase leading-5 text-[#2D2D2D] transition group-hover:text-[#FF7A00]">
            {item.title}
          </h3>
        </Link>

        <div className="text-[14px] font-normal leading-[18px] text-[#2D2D2D]">{item.size_label ? `ზომა ${item.size_label}` : conditionLabel(item.condition)}</div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[20px] font-semibold leading-8 ${isGift ? "text-[#e96b10]" : "text-[#212832]"}`}>
                {isGift ? "🎁 " : ""}{listingPriceLabel(item.price, item.currency, item.sale_type)}
              </span>
            </div>
          </div>

          {hasPromotion ? (
            <span className="inline-flex h-[30px] shrink-0 items-center justify-center rounded-full bg-[#073f3b] px-3 text-[12px] font-bold leading-5 text-white">
              {item.is_featured ? "VIP MAX" : item.is_promoted ? "TOP" : "VIP"}
            </span>
          ) : (
            <span className="text-[12px] text-[#616161]">{item.color || item.city || publishedLabel || ""}</span>
          )}
        </div>
      </div>
    </article>
  )
}
