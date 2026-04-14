import { SkeletonBlock } from "@/components/shared/SectionSkeleton"

export default function ChatThreadLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-10 w-full max-w-2xl" />
        <SkeletonBlock className="h-5 w-full max-w-lg" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SkeletonBlock className="h-[640px] w-full rounded-[2rem]" />
        <div className="space-y-4">
          <SkeletonBlock className="h-48 w-full rounded-[2rem]" />
          <SkeletonBlock className="h-56 w-full rounded-[2rem]" />
        </div>
      </div>
    </main>
  )
}
