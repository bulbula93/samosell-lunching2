export default function ListingFormSkeleton() {
  return (
    <main className="min-h-screen bg-bg px-4 py-7 sm:px-6 sm:py-10 lg:px-8" aria-busy="true" aria-label="ფორმა იტვირთება">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="ui-card p-7 sm:p-8">
          <div className="ui-skeleton h-3 w-32" />
          <div className="ui-skeleton mt-4 h-9 w-3/5" />
          <div className="ui-skeleton mt-3 h-5 w-4/5" />
        </div>
        <div className="ui-card p-5 sm:p-8">
          <div className="ui-skeleton h-7 w-28" />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="ui-skeleton aspect-square rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="ui-card space-y-5 p-5 sm:p-8">
          <div className="ui-skeleton h-7 w-44" />
          <div className="ui-skeleton h-11 w-full" />
          <div className="ui-skeleton h-40 w-full" />
        </div>
      </div>
      <p className="ui-sr-status" role="status">განცხადების ფორმა იტვირთება.</p>
    </main>
  )
}
