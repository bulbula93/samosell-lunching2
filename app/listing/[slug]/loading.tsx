import { SkeletonBlock } from "@/components/shared/SectionSkeleton"

export default function ListingLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
        <div className="space-y-4">
          <SkeletonBlock className="aspect-[4/5] w-full rounded-[2rem]" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} className="aspect-[4/5] w-full rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="mt-4 h-10 w-full max-w-xl" />
            <SkeletonBlock className="mt-5 h-8 w-40" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-5 w-full" />
              ))}
            </div>
          </div>
          <SkeletonBlock className="h-48 w-full rounded-[2rem]" />
          <SkeletonBlock className="h-56 w-full rounded-[2rem]" />
        </div>
      </div>
    </main>
  )
}
