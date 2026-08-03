import { MarketplaceProductCardSkeleton } from "@/components/listings/MarketplaceProductCard"

export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-bg" aria-busy="true" aria-label="მთავარი გვერდი იტვირთება">
      <div className="h-[72px] border-b border-line bg-white" />
      <section className="ui-container grid min-h-[500px] items-center gap-10 py-12 md:grid-cols-2">
        <div>
          <div className="ui-skeleton h-4 w-44" />
          <div className="ui-skeleton mt-6 h-16 w-full max-w-xl" />
          <div className="ui-skeleton mt-4 h-16 w-4/5 max-w-lg" />
          <div className="ui-skeleton mt-7 h-12 w-72" />
        </div>
        <div className="ui-skeleton mx-auto aspect-square w-full max-w-[440px] rounded-[32px]" />
      </section>
      <section className="ui-container py-12">
        <div className="ui-skeleton mb-8 h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => <MarketplaceProductCardSkeleton key={index} />)}
        </div>
      </section>
      <p className="ui-sr-status" role="status">მთავარი გვერდი იტვირთება</p>
    </main>
  )
}
