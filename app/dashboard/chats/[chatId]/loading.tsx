import { SkeletonBlock } from "@/components/shared/SectionSkeleton"

export default function ChatThreadLoading() {
  return (
    <main className="ui-container py-8 sm:py-10" aria-busy="true" aria-label="მიმოწერა იტვირთება">
      <p role="status" className="sr-only">მიმოწერა იტვირთება.</p>
      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-10 w-full max-w-2xl" />
        <SkeletonBlock className="h-5 w-full max-w-lg" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SkeletonBlock className="h-[640px] w-full rounded-2xl" />
        <div className="space-y-4">
          <SkeletonBlock className="h-48 w-full rounded-2xl" />
          <SkeletonBlock className="h-56 w-full rounded-2xl" />
        </div>
      </div>
    </main>
  )
}
