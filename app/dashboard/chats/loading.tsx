import { SkeletonBlock } from "@/components/shared/SectionSkeleton"

export default function DashboardChatsLoading() {
  return (
    <main className="ui-container py-8 sm:py-10" aria-busy="true" aria-label="შეტყობინებები იტვირთება">
      <p role="status" className="sr-only">შეტყობინებები იტვირთება.</p>
      <div className="mb-8 space-y-3">
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-5 w-full max-w-2xl" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="ui-card grid gap-4 p-4 md:grid-cols-[96px_1fr_auto] md:items-center">
            <SkeletonBlock className="aspect-[4/5] w-full rounded-xl" />
            <div className="space-y-3">
              <SkeletonBlock className="h-6 w-3/4" />
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-5 w-full" />
            </div>
            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-10 w-28" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
