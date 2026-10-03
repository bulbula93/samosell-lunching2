function ThreadRowSkeleton() {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-3 rounded-xl px-3 py-3">
      <div className="ui-skeleton h-12 w-12 rounded-full" />
      <div className="min-w-0">
        <div className="ui-skeleton h-4 w-28 max-w-full" />
        <div className="ui-skeleton mt-2 h-3 w-full" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="ui-skeleton h-3 w-9" />
        <div className="ui-skeleton h-5 w-5 rounded-full" />
      </div>
    </div>
  )
}

export default function ChatsLoading() {
  return (
    <main
      className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-col overflow-hidden px-0 py-0 md:px-5 md:py-5"
      aria-busy="true"
      aria-label="შეტყობინებები იტვირთება"
    >
      <div className="flex min-h-0 flex-1 overflow-hidden bg-white md:min-h-[620px] md:rounded-2xl md:border md:border-line md:shadow-[0_18px_60px_rgba(7,63,59,0.08)] lg:h-[calc(100dvh-8rem)]">
        <aside className="flex min-w-0 w-full flex-col border-line bg-white lg:w-[350px] lg:shrink-0 lg:border-r">
          <div className="border-b border-line px-4 pb-4 pt-5">
            <div className="ui-skeleton h-3 w-28" />
            <div className="ui-skeleton mt-3 h-8 w-44" />
            <div className="ui-skeleton mt-4 h-11 w-full rounded-xl" />
            <div className="mt-3 flex gap-2">
              <div className="ui-skeleton h-9 w-20 rounded-full" />
              <div className="ui-skeleton h-9 w-24 rounded-full" />
              <div className="ui-skeleton h-9 w-20 rounded-full" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-2">
            {Array.from({ length: 7 }).map((_, index) => (
              <ThreadRowSkeleton key={index} />
            ))}
          </div>

          <div className="border-t border-line p-3">
            <div className="ui-skeleton h-11 w-full rounded-xl" />
          </div>
        </aside>

        <section className="hidden min-w-0 flex-1 flex-col bg-surface-alt/30 lg:flex">
          <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-4">
            <div className="ui-skeleton h-11 w-11 rounded-full" />
            <div>
              <div className="ui-skeleton h-4 w-36" />
              <div className="ui-skeleton mt-2 h-3 w-24" />
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-3 p-5">
            <div className="ui-skeleton h-16 w-3/5 rounded-2xl" />
            <div className="ui-skeleton ml-auto h-20 w-2/3 rounded-2xl" />
            <div className="ui-skeleton h-14 w-1/2 rounded-2xl" />
            <div className="ui-skeleton ml-auto h-16 w-3/5 rounded-2xl" />
          </div>

          <div className="border-t border-line bg-white p-4">
            <div className="ui-skeleton h-12 w-full rounded-2xl" />
          </div>
        </section>
      </div>

      <p role="status" className="ui-sr-status">შეტყობინებები იტვირთება</p>
    </main>
  )
}
