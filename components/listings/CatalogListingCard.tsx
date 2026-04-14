import Link from "next/link"
import FavoriteToggleForm from "@/components/favorites/FavoriteToggleForm"
import SmartImage from "@/components/shared/SmartImage"
import { activePromotionBadges, promotionBadgeClass } from "@/lib/boosts"
import { conditionLabel, relativePublishedLabel } from "@/lib/listings"
import type { CatalogListing } from "@/types/marketplace"

type CatalogListingCardProps = { item: CatalogListing; isFavorited?: boolean; currentPath?: string }

export default function CatalogListingCard({ item, isFavorited = false, currentPath = "/catalog" }: CatalogListingCardProps) {
  const badges = activePromotionBadges(item)
  const sellerLabel = item.seller_username ? `@${item.seller_username}` : item.seller_full_name ?? "უცნობი გამყიდველი"
  const publishedLabel = relativePublishedLabel(item.published_at)
  const detailLine = [item.size_label, conditionLabel(item.condition), item.brand_name].filter(Boolean)
  const favoritesCount = item.favorites_count ?? 0
  const viewsCount = item.views_count ?? 0
  const locationLabel = item.city || "საქართველო"

  return (
    <article className="group overflow-hidden rounded-[1rem] border border-line bg-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(23,23,23,0.08)]">
      <div className="relative overflow-hidden rounded-t-[1rem] transition duration-200 group-hover:border-b-0">
        <Link href={`/listing/${item.slug}`} className="group block aspect-[3/4] bg-surface-alt">
          <SmartImage src={item.cover_image_url} alt={item.title} wrapperClassName="h-full w-full" className="transition duration-300 group-hover:scale-[1.03]" fallbackLabel="სურათი არ არის დამატებული" />
        </Link>
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">{item.is_vip ? <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-white shadow-sm">VIP</span> : null}{item.seller_is_verified ? <span className="rounded-full bg-white/92 px-3 py-1 text-[11px] font-semibold text-brand shadow-sm">დადასტურებული</span> : null}</div>
        <div className="absolute bottom-3 right-3"><FavoriteToggleForm listingId={item.id} listingSlug={item.slug} nextPath={currentPath} isFavorited={isFavorited} compact /></div>
        {badges.length > 0 ? <div className="absolute bottom-3 left-3 flex max-w-[82%] flex-wrap gap-2">{badges.slice(0,2).map((badge) => <span key={badge} className={promotionBadgeClass(badge) + " px-3 py-1 text-[10px] shadow-sm"}>{badge}</span>)}</div> : viewsCount > 0 ? <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">ნახვები {viewsCount}</div> : null}
      </div>
      <div className="p-4">
        <Link href={`/listing/${item.slug}`} className="block"><h3 className="line-clamp-2 min-h-[3rem] text-base font-semibold leading-6 text-text transition hover:text-brand">{item.title}</h3></Link>
        <div className="mt-3 text-2xl font-bold text-brand">{item.price} {item.currency === "GEL" ? "₾" : item.currency}</div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-soft">{detailLine.length > 0 ? detailLine.map((entry) => <span key={entry} className="rounded-md bg-surface-alt px-2.5 py-1.5">{entry}</span>) : <span className="rounded-md bg-surface-alt px-2.5 py-1.5">დეტალები პროფილში</span>}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-text-soft"><div className="min-w-0 truncate">{item.seller_username ? <Link href={`/seller/${item.seller_username}`} className="font-medium transition hover:text-brand">{sellerLabel}</Link> : <span className="font-medium">{sellerLabel}</span>}</div><span className="truncate">{locationLabel}</span></div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-text-soft"><div className="flex flex-wrap items-center gap-2">{favoritesCount > 0 ? <span className="rounded-full bg-surface-alt px-2.5 py-1">ფავორიტი {favoritesCount}</span> : null}{publishedLabel ? <span className="rounded-full bg-surface-alt px-2.5 py-1">{publishedLabel}</span> : null}{favoritesCount === 0 && !publishedLabel ? <span className="rounded-full bg-surface-alt px-2.5 py-1">ახლად დამატებული</span> : null}</div><Link href={`/listing/${item.slug}`} className="font-semibold text-brand transition hover:text-brand-hover">დეტალურად</Link></div>
      </div>
    </article>
  )
}
