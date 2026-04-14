import { SkeletonBlock } from "@/components/shared/SectionSkeleton"

export default function DashboardChatsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-10 w-64" />
          <SkeletonBlock className="h-5 w-full max-w-2xl" />
        </div>
        <SkeletonBlock className="h-28 w-full max-w-[220px]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid gap-4 rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-[110px_1fr_auto] md:items-center">
            <SkeletonBlock className="aspect-[4/5] w-full rounded-[1.5rem]" />
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
