export default function MyListingsLoading() {
  return (
    <main
      className="min-h-screen bg-bg py-7 text-text sm:py-10"
      aria-busy="true"
      aria-label="ჩემი განცხადებები იტვირთება"
    >
      <div className="ui-container max-w-6xl">
        <div className="ui-skeleton h-4 w-36" />
        <div className="ui-skeleton mt-4 h-10 w-72 max-w-full" />
        <div className="ui-skeleton mt-3 h-5 w-full max-w-xl" />

        <div className="mt-7 flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="ui-skeleton h-11 w-28 shrink-0" />
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="ui-card grid overflow-hidden sm:grid-cols-[180px_minmax(0,1fr)]"
            >
              <div className="ui-skeleton h-48 rounded-none sm:h-full" />
              <div className="p-5">
                <div className="ui-skeleton h-7 w-28" />
                <div className="ui-skeleton mt-4 h-7 w-3/4" />
                <div className="ui-skeleton mt-3 h-6 w-32" />
                <div className="ui-skeleton mt-7 h-11 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p role="status" className="ui-sr-status">
        ჩემი განცხადებები იტვირთება
      </p>
    </main>
  )
}
