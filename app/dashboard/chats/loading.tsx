import { SkeletonBlock } from "@/components/shared/SectionSkeleton"

export default function DashboardChatsLoading() {
  return (
    <main
      className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[1600px] overflow-hidden bg-white md:min-h-[620px] md:px-5 md:py-5"
      aria-busy="true"
      aria-label="შეტყობინებები იტვირთება"
    >
      <p role="status" className="sr-only">შეტყობინებები იტვირთება.</p>

      <div className="flex min-h-0 flex-1 overflow-hidden md:rounded-2xl md:border md:border-line md:shadow-[0_18px_60px_rgba(7,63,59,0.08)]">
        <aside className="flex min-w-0 w-full flex-col border-line bg-white lg:w-[350px] lg:shrink-0 lg:border-r">
          <div className="shrink-0 border-b border-line p-3 sm:p-4">
            <SkeletonBlock className="h-5 w-28" />
            <SkeletonBlock className="mt-3 h-11 w-full rounded-xl" />
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
            <div className="space-y-1.5">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="flex min-h-[78px] items-center gap-3 rounded-xl px-2 py-2.5">
                  <SkeletonBlock className="h-12 w-12 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <SkeletonBlock className="h-4 w-2/3" />
                    <SkeletonBlock className="mt-2 h-3.5 w-5/6" />
                  </div>
                  <SkeletonBlock className="h-3 w-10 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="hidden min-w-0 flex-1 flex-col bg-surface-alt/25 lg:flex" aria-hidden="true">
          <div className="flex h-20 items-center gap-3 border-b border-line bg-white px-5">
            <SkeletonBlock className="h-11 w-11 rounded-full" />
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="mt-2 h-3 w-24" />
            </div>
          </div>
          <div className="flex-1 space-y-4 px-6 py-6">
            <SkeletonBlock className="h-14 w-2/5 rounded-2xl" />
            <SkeletonBlock className="ml-auto h-16 w-1/2 rounded-2xl" />
            <SkeletonBlock className="h-12 w-1/3 rounded-2xl" />
          </div>
          <div className="border-t border-line bg-white p-4">
            <SkeletonBlock className="h-12 w-full rounded-2xl" />
          </div>
        </section>
      </div>
    </main>
  )
}
