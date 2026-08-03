import { ka } from "@/lib/i18n/ka"

export default function MarketplaceSearch({
  defaultValue = "",
  compact = false,
}: {
  defaultValue?: string
  compact?: boolean
}) {
  return (
    <form action="/catalog" role="search" className="w-full">
      <label htmlFor={compact ? "mobile-marketplace-search" : "marketplace-search"} className="sr-only">
        {ka.nav.searchPlaceholder}
      </label>
      <div className="relative flex items-center">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 text-lg text-text-soft">
          ⌕
        </span>
        <input
          id={compact ? "mobile-marketplace-search" : "marketplace-search"}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={ka.nav.searchPlaceholder}
          className={`w-full rounded-xl border border-line bg-white pl-11 text-sm text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft ${
            compact ? "h-11 pr-20" : "h-12 pr-24"
          }`}
        />
        <button
          type="submit"
          className={`absolute right-1.5 inline-flex items-center justify-center rounded-lg bg-brand px-4 text-xs font-bold text-white transition hover:bg-brand-hover ${
            compact ? "h-8" : "h-9"
          }`}
        >
          {ka.nav.search}
        </button>
      </div>
    </form>
  )
}
