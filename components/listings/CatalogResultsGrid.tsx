import Link from "next/link"
import CatalogLandingCard from "@/components/listings/CatalogLandingCard"
import type { CatalogListing } from "@/types/marketplace"

export default function CatalogResultsGrid({
  listings,
  currentPath,
  favoriteIds,
  sellerItemCounts,
}: {
  listings: CatalogListing[]
  currentPath: string
  favoriteIds: string[]
  sellerItemCounts: Record<string, number>
}) {
  if (listings.length === 0) {
    return (
      <div className="rounded-[12px] border border-[#D7D7D7] bg-white px-6 py-12 text-center shadow-[0_12px_28px_rgba(33,40,49,0.04)]">
        <div className="text-2xl font-bold text-[#212832]">ამ ფილტრებზე ნივთი ვერ მოიძებნა</div>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#616161]">შეცვალე სექცია, გააფართოვე ფილტრები ან გაასუფთავე მიმდინარე არჩევანი.</p>
        <div className="mt-6">
          <Link href="/catalog" className="inline-flex h-12 items-center justify-center rounded-full border border-[#2D2D2D] bg-[#F88A51] px-6 text-sm font-semibold text-white transition hover:bg-[#ef7d46]">
            ყველა ნივთის ნახვა
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-x-4 xl:gap-y-8">
      {listings.map((item) => (
        <CatalogLandingCard
          key={item.id}
          item={item}
          currentPath={currentPath}
          isFavorited={favoriteIds.includes(item.id)}
          sellerItemCount={item.seller_id ? sellerItemCounts[item.seller_id] ?? 0 : 0}
        />
      ))}
    </div>
  )
}
