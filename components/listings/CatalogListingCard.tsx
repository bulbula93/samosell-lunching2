import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import type { CatalogListing } from "@/types/marketplace"

type CatalogListingCardProps = {
  item: CatalogListing
  isFavorited?: boolean
  currentPath?: string
}

export default function CatalogListingCard({
  item,
  isFavorited = false,
  currentPath = "/catalog",
}: CatalogListingCardProps) {
  return (
    <MarketplaceProductCard
      item={item}
      isFavorited={isFavorited}
      currentPath={currentPath}
    />
  )
}
