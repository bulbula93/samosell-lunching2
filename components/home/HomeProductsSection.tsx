import Link from "next/link"
import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function HomeProductsSection({
  id, title, description, href, items, favoriteIds, layout = "grid",
}: {
  id?: string
  title: string
  description?: string
  href: string
  items: CatalogListing[]
  favoriteIds: string[]
  layout?: "grid" | "horizontal"
}) {
  if (items.length === 0) return null

  const cards = items.slice(0, 10).map((item) => (
    <MarketplaceProductCard key={`${title}-${item.id}`} item={item} currentPath="/" isFavorited={favoriteIds.includes(item.id)} />
  ))

  return (
    <section id={id} className="border-b border-line/70 bg-white py-10 sm:py-13">
      <div className="ui-container">
        <div className="mb-6 flex items-end justify-between gap-5">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.035em] text-brand sm:text-3xl">{title}</h2>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">{description}</p> : null}
          </div>
          <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-black text-brand transition hover:text-accent sm:inline-flex">
            {ka.home.viewAll} <span aria-hidden="true">→</span>
          </Link>
        </div>

        {layout === "horizontal" ? (
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
            {cards.map((card, index) => (
              <div key={`${title}-rail-${items[index]?.id ?? index}`} className="w-[76vw] max-w-[260px] shrink-0 snap-start sm:w-[240px] lg:w-[250px]">{card}</div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5">{cards}</div>
        )}

        <Link href={href} className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-brand/15 bg-[#f7f9f8] text-sm font-black text-brand sm:hidden">
          {ka.home.viewAll}
        </Link>
      </div>
    </section>
  )
}
