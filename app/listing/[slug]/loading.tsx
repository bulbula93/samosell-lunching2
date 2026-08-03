import { ka } from "@/lib/i18n/ka"

export default function ListingLoading() {
  return (
    <>
      <div aria-hidden="true" className="h-[72px] border-b border-line bg-white" />
      <main
        className="min-h-screen bg-bg"
        aria-busy="true"
        aria-label={ka.listingDetail.loading}
      >
        <div className="ui-container pt-6">
          <div className="ui-skeleton h-4 w-64 max-w-full" />
        </div>
        <section className="ui-container pb-16 pt-7">
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:gap-10">
            <div>
              <div className="ui-skeleton aspect-[4/5] w-full sm:aspect-square" />
              <div className="mt-3 flex gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="ui-skeleton aspect-square w-20 sm:w-24" />
                ))}
              </div>
            </div>
            <div className="ui-card p-5 sm:p-6">
              <div className="ui-skeleton h-8 w-32" />
              <div className="ui-skeleton mt-5 h-4 w-24" />
              <div className="ui-skeleton mt-3 h-10 w-full max-w-md" />
              <div className="ui-skeleton mt-5 h-10 w-40" />
              <div className="mt-8 grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="ui-skeleton h-14 w-full" />
                ))}
              </div>
              <div className="ui-skeleton mt-8 h-28 w-full" />
              <div className="ui-skeleton mt-8 h-20 w-full" />
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="ui-skeleton h-11 w-full" />
                <div className="ui-skeleton h-11 w-full" />
              </div>
            </div>
          </div>
        </section>
        <p role="status" className="ui-sr-status">
          {ka.listingDetail.loading}
        </p>
      </main>
    </>
  )
}
