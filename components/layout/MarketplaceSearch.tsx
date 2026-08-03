import { ka } from "@/lib/i18n/ka"

export default function MarketplaceSearch({
  defaultValue = "",
  compact = false,
  id,
}: {
  defaultValue?: string
  compact?: boolean
  id?: string
}) {
  const inputId = id || (compact ? "mobile-marketplace-search" : "marketplace-search")

  return (
    <form action="/catalog" role="search" className="w-full">
      <label htmlFor={inputId} className="sr-only">
        {ka.nav.searchPlaceholder}
      </label>
      <div className="relative flex items-center">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 text-lg text-text-soft">
          ⌕
        </span>
        <input
          id={inputId}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={ka.nav.searchPlaceholder}
          className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-24 text-sm text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft"
        />
        <button
          type="submit"
          className="absolute right-0.5 inline-flex h-11 items-center justify-center rounded-[10px] bg-brand px-4 text-xs font-bold text-white transition hover:bg-brand-hover"
        >
          {ka.nav.search}
        </button>
      </div>
    </form>
  )
}
