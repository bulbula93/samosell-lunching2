import Link from "next/link"
import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function SimilarListingsSection({
  listingSlug,
  similarItems,
  favoriteIds,
}: {
  listingSlug: string
  similarItems: CatalogListing[]
  favoriteIds: string[]
}) {
  if (similarItems.length === 0) return null

  const visibleItems = similarItems.slice(0, 8)

  return (
    <section
      aria-labelledby="similar-listings-heading"
      className="border-t border-line bg-white"
    >
      <div className="ui-container py-12 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ui-eyebrow">{ka.listingDetail.category}</p>
            <h2
              id="similar-listings-heading"
              className="mt-2 text-2xl font-black text-text sm:text-3xl"
            >
              {ka.listingDetail.similar}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-soft">
              {ka.listingDetail.similarDescription}
            </p>
          </div>
          <Link href="/catalog" className="ui-btn-secondary">
            {ka.home.viewAll}
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
          {visibleItems.map((item) => (
            <MarketplaceProductCard
              key={item.id}
              item={item}
              currentPath={`/listing/${listingSlug}`}
              isFavorited={favoriteIds.includes(item.id)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
