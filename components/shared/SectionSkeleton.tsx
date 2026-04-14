export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-neutral-200 ${className}`} aria-hidden="true" />
}
