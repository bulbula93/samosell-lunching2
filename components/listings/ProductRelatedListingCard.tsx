import Link from "next/link"
import FavoriteToggleForm from "@/components/favorites/FavoriteToggleForm"
import SmartImage from "@/components/shared/SmartImage"
import type { CatalogListing } from "@/types/marketplace"

function StarStrip() {
  return (
    <div className="flex items-center gap-[2px] text-[#F88A51]">
      {Array.from({ length: 4 }).map((_, index) => (
        <svg key={index} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-3 w-3">
          <path d="M12 2.9 14.8 8.6l6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20l1-6.1-4.4-4.4 6.1-.9L12 2.9Z" />
        </svg>
      ))}
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-3 w-3 text-[#F88A51]">
        <path d="M12 2.9 14.8 8.6l6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20l1-6.1-4.4-4.4 6.1-.9L12 2.9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function formatCurrentPrice(price: number) {
  return Number.isFinite(price) ? String(Math.round(price)) : "0"
}

function formatOldPrice(price: number, currency: string) {
  const oldPrice = Math.round(price * 1.25)
  return `${oldPrice} ${currency === "GEL" ? "₾" : currency}`
}

export default function ProductRelatedListingCard({ item, isFavorited, currentPath }: { item: CatalogListing; isFavorited: boolean; currentPath: string }) {
  const sellerLabel = item.seller_full_name || item.seller_username || "Nickname"
  const sizeLabel = item.size_label || "44"

  return (
    <article className="w-full max-w-[243px] space-y-2">
      <div className="relative overflow-hidden rounded-[8px] bg-white">
        <Link href={`/listing/${item.slug}`} className="block h-[256px] overflow-hidden rounded-[8px] bg-[#F3F3F3]">
          <SmartImage src={item.cover_image_url} alt={item.title} wrapperClassName="h-full w-full" className="object-cover" fallbackLabel="სურათი" />
        </Link>
        <div className="absolute bottom-3 right-2">
          <FavoriteToggleForm listingId={item.id} listingSlug={item.slug} nextPath={currentPath} isFavorited={isFavorited} compact className="h-8 w-8 rounded-full border-0 bg-[#212831]" />
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between gap-3 text-[14px] font-medium leading-5 text-[#2D2D2D]">
            <span className="truncate">{sellerLabel}</span>
            <span className="text-[14px] font-bold text-[#F88A51] underline underline-offset-2">12 ნივთი</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StarStrip />
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 text-[14px] leading-5 text-[#2D2D2D]">
          <Link href={`/listing/${item.slug}`} className="line-clamp-1 flex-1 font-normal uppercase">
            {item.title}
          </Link>
          <span className="shrink-0 text-[14px]">ზომა {sizeLabel}</span>
        </div>

        <div className="flex items-end gap-2">
          <span className="text-[16px] font-bold leading-6 text-[#2D2D2D]">{formatCurrentPrice(item.price)}</span>
          <span className="text-[16px] text-[#9E9E9E] line-through">{formatOldPrice(item.price, item.currency)}</span>
        </div>

        <div className="inline-flex h-8 items-center justify-center rounded-full bg-[#F3AE49] px-3 text-[14px] font-semibold text-white">
          -10%
        </div>
      </div>
    </article>
  )
}
