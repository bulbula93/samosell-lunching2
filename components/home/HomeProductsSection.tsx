import Link from "next/link"
import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function HomeProductsSection({
  id,
  title,
  description,
  href,
  items,
  favoriteIds,
  layout = "grid",
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
    <MarketplaceProductCard
      key={`${title}-${item.id}`}
      item={item}
      currentPath="/"
      isFavorited={favoriteIds.includes(item.id)}
    />
  ))

  return (
    <section id={id} className="border-b border-line bg-bg py-12 sm:py-16">
      <div className="ui-container">
        <div className="mb-7 flex items-end justify-between gap-5">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.025em] text-text sm:text-3xl">{title}</h2>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">{description}</p> : null}
          </div>
          <Link href={href} className="hidden shrink-0 text-sm font-bold text-brand underline-offset-4 hover:underline sm:inline">
            {ka.home.viewAll}
          </Link>
        </div>

        {layout === "horizontal" ? (
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
            {cards.map((card, index) => (
              <div key={`${title}-rail-${items[index]?.id ?? index}`} className="w-[76vw] max-w-[260px] shrink-0 snap-start sm:w-[240px] lg:w-[250px]">
                {card}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-5">
            {cards}
          </div>
        )}

        <Link href={href} className="ui-btn-secondary mt-8 w-full sm:hidden">
          {ka.home.viewAll}
        </Link>
      </div>
    </section>
  )
}
