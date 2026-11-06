import PromotionExpiry from "@/components/shared/PromotionExpiry"
import Link from "next/link"
import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function HomeProductsSection({
  id, title, description, href, items, favoriteIds, layout = "grid", promotionOnly = false, mobileLimit,
}: {
  id?: string
  title: string
  description?: string
  href: string
  items: CatalogListing[]
  favoriteIds: string[]
  /**
   * "grid": 2 columns on phones, 3–5 on larger screens.
   * "horizontal": swipeable rail of large cards on every screen (VIP rail).
   * "rail": swipeable compact rail on phones (2+ cards visible), regular grid from `sm` up.
   */
  layout?: "grid" | "horizontal" | "rail"
  promotionOnly?: boolean
  /** Grid only: show at most this many cards on phones (the rest from `sm` up). */
  mobileLimit?: number
}) {
  if (items.length === 0) return null

  const cards = items.slice(0, 10).map((item) => {
    const card = <MarketplaceProductCard key={`${title}-${item.id}`} item={item} currentPath="/" isFavorited={favoriteIds.includes(item.id)} />
    return promotionOnly
      ? <PromotionExpiry key={`${title}-${item.id}`} until={item.vip_until}>{card}</PromotionExpiry>
      : card
  })

  return (
    <section id={id} className="border-b border-line/70 bg-white py-7 sm:py-13">
      <div className="ui-container">
        <div className="mb-4 flex items-end justify-between gap-5 sm:mb-6">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.035em] text-brand sm:text-3xl">{title}</h2>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">{description}</p> : null}
          </div>
          <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-black text-brand transition hover:text-accent sm:inline-flex">
            {ka.home.viewAll} <span aria-hidden="true">→</span>
          </Link>
        </div>

        {layout === "rail" ? (
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5" data-home-rail>
            {cards.map((card, index) => (
              <div key={`${title}-rail-${items[index]?.id ?? index}`} className="w-[42vw] max-w-[190px] shrink-0 snap-start sm:w-auto sm:max-w-none">{card}</div>
            ))}
          </div>
        ) : layout === "horizontal" ? (
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
            {cards.map((card, index) => (
              <div key={`${title}-rail-${items[index]?.id ?? index}`} className="w-[76vw] max-w-[260px] shrink-0 snap-start sm:w-[240px] lg:w-[250px]">{card}</div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5">
            {mobileLimit
              ? cards.map((card, index) => index < mobileLimit ? card : <div key={`${title}-more-${items[index]?.id ?? index}`} className="hidden sm:block">{card}</div>)
              : cards}
          </div>
        )}

        <Link href={href} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-brand/15 bg-[#f7f9f8] text-sm font-black text-brand sm:hidden">
          {ka.home.viewAll}
        </Link>
      </div>
    </section>
  )
}
