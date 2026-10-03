export default function DashboardLoading() {
  return (
    <main
      className="ui-page-shell"
      aria-busy="true"
      aria-label="კაბინეტი იტვირთება"
    >
      <div className="ui-page-container max-w-7xl">
        <section className="ui-card relative overflow-hidden p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="ui-skeleton h-20 w-20 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="ui-skeleton h-3 w-24" />
                <div className="ui-skeleton mt-3 h-9 w-56 max-w-full" />
                <div className="ui-skeleton mt-3 h-4 w-full max-w-2xl" />
                <div className="ui-skeleton mt-2 h-4 w-3/4 max-w-xl" />
              </div>
            </div>
            <div className="flex gap-2 overflow-hidden">
              <div className="ui-skeleton h-11 w-24 shrink-0 rounded-xl" />
              <div className="ui-skeleton h-11 w-28 shrink-0 rounded-xl" />
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="ui-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="ui-skeleton h-4 w-20" />
                <div className="ui-skeleton h-9 w-9 rounded-xl" />
              </div>
              <div className="ui-skeleton mt-5 h-8 w-16" />
              <div className="ui-skeleton mt-3 h-3 w-24 max-w-full" />
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="ui-card p-5 sm:p-6">
              <div className="ui-skeleton h-3 w-28" />
              <div className="ui-skeleton mt-3 h-8 w-56 max-w-full" />
              <div className="mt-6 space-y-3">
                {Array.from({ length: index === 0 ? 5 : 6 }).map((__, row) => (
                  <div key={row} className="ui-skeleton h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
      <p role="status" className="ui-sr-status">კაბინეტი იტვირთება</p>
    </main>
  )
}
