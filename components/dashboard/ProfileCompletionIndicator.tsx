import Link from "next/link"
import type { ProfileCompletion } from "@/lib/profile-completion"

type ProfileCompletionIndicatorProps = {
  completion: ProfileCompletion
  context?: "profile" | "listing"
  className?: string
}

export default function ProfileCompletionIndicator({
  completion,
  context = "profile",
  className = "",
}: ProfileCompletionIndicatorProps) {
  const complete = completion.percentage === 100
  const missingLabels = completion.missing.map((item) => item.label)

  return (
    <section className={`rounded-[1.75rem] border border-line bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="ui-eyebrow">პროფილის შევსება</p>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${complete ? "bg-emerald-50 text-emerald-700" : "bg-brand-soft text-brand"}`}>
              {completion.percentage}%
            </span>
          </div>
          <h2 className="mt-2 text-xl font-black text-text">
            {complete ? "პროფილი სრულად შევსებულია" : `${completion.completedCount}/${completion.totalCount} ძირითადი მონაცემი შევსებულია`}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            {complete
              ? "მყიდველს შენი ძირითადი პროფილის ინფორმაცია სრულად გამოუჩნდება."
              : context === "listing"
                ? `აკლია: ${missingLabels.join(", ")}. ტელეფონი სავალდებულოა განცხადების გამოსაქვეყნებლად; დანარჩენი მონაცემები ზრდის პროფილის სანდოობას.`
                : `დაასრულე ძირითადი პროფილი: ${missingLabels.join(", ")}.`}
          </p>
        </div>
        {context === "listing" && !complete ? (
          <Link href="/dashboard/profile" className="ui-btn-secondary shrink-0 text-center">
            პროფილის შევსება
          </Link>
        ) : null}
      </div>

      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface-alt" aria-hidden="true">
        <div
          className="h-full rounded-full bg-brand transition-[width]"
          style={{ width: `${completion.percentage}%` }}
        />
      </div>
      <div
        role="progressbar"
        aria-label="პროფილის შევსების პროგრესი"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion.percentage}
        className="sr-only"
      >
        {completion.percentage}%
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {completion.items.map((item) => (
          <div
            key={item.key}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold ${
              item.complete
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : item.requiredForListing
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-line bg-surface-alt text-text-soft"
            }`}
          >
            <span aria-hidden="true">{item.complete ? "✓" : "○"}</span>
            <span>{item.label}</span>
            {!item.complete && item.requiredForListing ? (
              <span className="ml-auto text-[10px] font-black uppercase tracking-wide">სავალდ.</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
