"use client"

import { useFormStatus } from "react-dom"
import { useHomePersonalization } from "@/components/home/HomePersonalizationProvider"

type FavoriteSubmitButtonProps = {
  listingId?: string
  isFavorited: boolean
  compact?: boolean
  className?: string
}

function HeartIcon({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={compact ? "h-[15px] w-[15px]" : "h-[18px] w-[18px]"}
      fill="currentColor"
    >
      <path d="M12.001 21.133a1.7 1.7 0 0 1-.914-.267l-.013-.008-.099-.064c-.912-.592-2.802-1.821-4.64-3.492-1.103-1.004-1.995-2.001-2.65-2.963C2.883 13.162 2.5 12.06 2.5 10.97 2.5 7.694 5.136 5.1 8.317 5.1c1.425 0 2.78.527 3.826 1.478 1.047-.951 2.402-1.478 3.827-1.478 3.18 0 5.816 2.594 5.816 5.87 0 1.09-.383 2.191-1.185 3.37-.654.962-1.547 1.96-2.65 2.963-1.837 1.671-3.728 2.9-4.64 3.492l-.099.064-.013.008a1.7 1.7 0 0 1-.915.267Z" />
    </svg>
  )
}

export default function FavoriteSubmitButton({
  listingId,
  isFavorited,
  compact = false,
  className,
}: FavoriteSubmitButtonProps) {
  const { pending } = useFormStatus()
  const personalization = useHomePersonalization()
  const effectiveIsFavorited =
    listingId && personalization?.loaded
      ? personalization.favoriteIds.includes(listingId)
      : isFavorited

  if (compact) {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-label={effectiveIsFavorited ? "ფავორიტებიდან ამოშლა" : "ფავორიტებში დამატება"}
        aria-pressed={effectiveIsFavorited}
        title={effectiveIsFavorited ? "ფავორიტებში დამატებულია" : "ფავორიტებში დამატება"}
        className={[
          "inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand bg-brand transition duration-200",
          "disabled:cursor-wait disabled:opacity-70",
          "hover:scale-[1.04] hover:bg-brand-hover active:scale-[0.96]",
          className ?? "",
        ].join(" ")}
      >
        <span className={effectiveIsFavorited ? "text-[#b9fff5]" : "text-white"}>
          <HeartIcon compact />
        </span>
      </button>
    )
  }

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={effectiveIsFavorited ? "ფავორიტებიდან ამოშლა" : "ფავორიტებში დამატება"}
      aria-pressed={effectiveIsFavorited}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
        "disabled:cursor-wait disabled:opacity-70",
        effectiveIsFavorited
          ? "border-brand bg-brand text-white hover:bg-brand-hover"
          : "border-line bg-white text-text hover:border-brand hover:text-brand",
        className ?? "",
      ].join(" ")}
    >
      <span className={effectiveIsFavorited ? "text-[#b9fff5]" : "text-brand"}>
        <HeartIcon />
      </span>
      <span>{pending ? "იტვირთება..." : effectiveIsFavorited ? "შენახულია" : "ფავორიტებში"}</span>
    </button>
  )
}
