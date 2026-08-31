import Link from "next/link"
import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function CatalogResultsGrid({
  listings,
  currentPath,
  favoriteIds,
  searchId = null,
}: {
  listings: CatalogListing[]
  currentPath: string
  favoriteIds: string[]
  searchId?: string | null
}) {
  if (listings.length === 0) {
    return (
      <div role="status" className="ui-card border-dashed px-6 py-14 text-center sm:py-20">
        <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-2xl text-brand">⌕</div>
        <h2 className="mt-5 text-2xl font-black text-text">{ka.catalog.emptyTitle}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-soft">{ka.catalog.emptyDescription}</p>
        <Link href="/catalog" className="ui-btn-primary mt-7">{ka.catalog.clear}</Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((item) => (
        <MarketplaceProductCard
          key={item.id}
          item={item}
          currentPath={currentPath}
          isFavorited={favoriteIds.includes(item.id)}
          searchId={searchId}
        />
      ))}
    </div>
  )
}
