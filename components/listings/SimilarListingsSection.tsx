import Link from "next/link"
import ProductRelatedListingCard from "@/components/listings/ProductRelatedListingCard"
import type { CatalogListing } from "@/types/marketplace"

function ArrowButton({ direction }: { direction: "left" | "right" }) {
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "წინა" : "შემდეგი"}
      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-black/16 bg-white text-[#FD681B] transition hover:bg-[#FAFAFA]"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
        <path d={direction === "left" ? "M14.5 5 8 11.5 14.5 18" : "M9.5 5 16 11.5 9.5 18"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

export default function SimilarListingsSection({
  listingSlug,
  similarItems,
  favoriteIds,
}: {
  listingSlug: string
  similarItems: CatalogListing[]
  favoriteIds: string[]
}) {
  const visibleItems = similarItems.slice(0, 5)

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-[56px] sm:px-6 lg:px-8 xl:px-[80px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <h2 className="text-[28px] font-bold uppercase leading-8 text-[#2D2D2D]">ბოლოს დამატებული პროდუქტები</h2>
            <div className="flex items-center gap-4">
              <span className="text-[16px] font-medium leading-6 text-[#2D2D2D]">{similarItems.length || 456} განცხადება</span>
              <Link href="/catalog" className="inline-flex h-10 items-center justify-center rounded-full border-2 border-[#2D2D2D] px-4 text-[14px] font-semibold text-[#2D2D2D] transition hover:bg-[#F7F7F7]">
                ნახე ყველა
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ArrowButton direction="left" />
            <ArrowButton direction="right" />
          </div>
        </div>

        {visibleItems.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {visibleItems.map((item) => (
              <ProductRelatedListingCard key={item.id} item={item} currentPath={`/listing/${listingSlug}`} isFavorited={favoriteIds.includes(item.id)} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
