import { SkeletonBlock } from "@/components/shared/SectionSkeleton"

export default function CatalogLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="space-y-4">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-10 w-full max-w-2xl" />
        <SkeletonBlock className="h-6 w-full max-w-3xl" />
      </div>
      <div className="mt-8 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[2fr_repeat(4,1fr)]">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-12 w-full" />
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[repeat(4,1fr)_auto_auto]">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-sm">
            <SkeletonBlock className="aspect-[4/5] w-full" />
            <SkeletonBlock className="mt-4 h-6 w-4/5" />
            <SkeletonBlock className="mt-2 h-4 w-3/5" />
            <SkeletonBlock className="mt-4 h-5 w-2/5" />
          </div>
        ))}
      </div>
    </main>
  )
}
