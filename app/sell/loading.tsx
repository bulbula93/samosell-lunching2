export default function SellLoading() {
  return <div className="min-h-screen" aria-busy="true" aria-label="გვერდი იტვირთება">
    <div aria-hidden="true" className="h-32 border-b border-line bg-white sm:h-[148px] md:h-[73px] lg:h-[118px]" />
    <div aria-hidden="true" className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-12">
      <div className="ui-card grid overflow-hidden md:grid-cols-2">
        <div className="space-y-5 p-6 sm:p-10"><div className="ui-skeleton h-4 w-44" /><div className="ui-skeleton h-32 w-full" /><div className="ui-skeleton h-14 w-full" /><div className="ui-skeleton h-12 w-full sm:w-52" /></div>
        <div className="ui-skeleton h-56 md:h-[390px]" />
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">{[1, 2, 3].map(step => <div key={step} className="ui-skeleton h-20 rounded-2xl" />)}</div>
    </div>
  </div>
}
