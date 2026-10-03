import { ka } from "@/lib/i18n/ka"

export default function ListingLoading() {
  return (
    <>
      <div aria-hidden="true" className="h-[120px] border-b border-line bg-white md:h-[72px]" />
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
              <div className="mt-3 hidden gap-3 sm:flex">
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
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
            <div className="space-y-6">
              <section className="ui-card p-5 sm:p-6">
                <div className="ui-skeleton h-4 w-28" />
                <div className="ui-skeleton mt-4 h-7 w-48" />
                <div className="mt-5 space-y-3">
                  <div className="ui-skeleton h-4 w-full" />
                  <div className="ui-skeleton h-4 w-full" />
                  <div className="ui-skeleton h-4 w-5/6" />
                </div>
              </section>

              <section className="ui-card p-5 sm:p-6">
                <div className="ui-skeleton h-4 w-32" />
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="ui-skeleton h-16 w-full rounded-2xl" />
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="ui-card p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="ui-skeleton h-12 w-12 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="ui-skeleton h-4 w-32 max-w-full" />
                    <div className="ui-skeleton mt-2 h-3 w-24" />
                  </div>
                </div>
                <div className="ui-skeleton mt-5 h-11 w-full rounded-xl" />
              </section>

              <section className="ui-card p-5 sm:p-6">
                <div className="ui-skeleton h-4 w-28" />
                <div className="ui-skeleton mt-4 h-14 w-full rounded-2xl" />
                <div className="ui-skeleton mt-3 h-14 w-full rounded-2xl" />
              </section>
            </div>
          </div>

          <section className="mt-8">
            <div className="ui-skeleton h-8 w-52" />
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-[20px] border border-line bg-white p-2">
                  <div className="ui-skeleton aspect-[4/5] w-full rounded-[15px]" />
                  <div className="ui-skeleton mt-3 h-4 w-4/5" />
                  <div className="ui-skeleton mt-2 h-5 w-2/5" />
                </div>
              ))}
            </div>
          </section>
        </section>

        <p role="status" className="ui-sr-status">
          {ka.listingDetail.loading}
        </p>
        <div
          aria-hidden="true"
          className="fixed inset-x-0 z-[65] flex items-center gap-3 border-t border-line bg-white px-3 py-2 md:hidden"
          style={{ bottom: "calc(var(--mobile-nav-offset) + env(safe-area-inset-bottom))" }}
        >
          <div className="min-w-0 flex-1">
            <div className="ui-skeleton h-3 w-10" />
            <div className="ui-skeleton mt-2 h-6 w-24" />
          </div>
          <div className="ui-skeleton h-11 w-28 rounded-xl" />
        </div>
      </main>
    </>
  )
}
