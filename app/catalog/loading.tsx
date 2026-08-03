import { MarketplaceProductCardSkeleton } from "@/components/listings/MarketplaceProductCard"

export default function CatalogLoading() {
  return (
    <main className="min-h-screen bg-bg" aria-busy="true" aria-label="კატალოგი იტვირთება">
      <div className="h-[72px] border-b border-line bg-white" />
      <div className="ui-container py-8 sm:py-10">
        <div className="ui-skeleton h-4 w-40" />
        <div className="ui-skeleton mt-4 h-10 w-64" />
        <div className="ui-skeleton mt-3 h-5 w-full max-w-2xl" />
        <div className="ui-card mt-8 hidden p-4 lg:block">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, index) => <div key={index} className="ui-skeleton h-11" />)}
          </div>
        </div>
        <div className="ui-skeleton mt-6 h-11 w-full lg:hidden" />
        <div className="mt-9 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => <MarketplaceProductCardSkeleton key={index} />)}
        </div>
      </div>
      <p role="status" className="ui-sr-status">კატალოგი იტვირთება</p>
    </main>
  )
}
