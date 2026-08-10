export default function OrdersLoading() {
  return (
    <main className="min-h-screen bg-bg py-7 text-text sm:py-10">
      <div className="ui-container max-w-6xl" aria-busy="true">
        <div className="ui-skeleton h-4 w-36" />
        <div className="ui-skeleton mt-4 h-10 w-64 max-w-full" />
        <div className="ui-skeleton mt-4 h-5 w-full max-w-2xl" />
        <div className="mt-8 space-y-4">
          {[0, 1].map((item) => (
            <div key={item} className="ui-card grid overflow-hidden sm:grid-cols-[180px_1fr]">
              <div className="ui-skeleton min-h-44 rounded-none" />
              <div className="space-y-4 p-5">
                <div className="ui-skeleton h-8 w-40" />
                <div className="ui-skeleton h-7 w-3/4" />
                <div className="ui-skeleton h-5 w-28" />
                <div className="ui-skeleton h-11 w-full" />
              </div>
            </div>
          ))}
        </div>
        <p role="status" className="ui-sr-status">შეკვეთები იტვირთება.</p>
      </div>
    </main>
  )
}
