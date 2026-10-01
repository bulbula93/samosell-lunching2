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
    <form action="/catalog" role="search" className="w-full min-w-0 max-w-full">
      <label htmlFor={inputId} className="sr-only">
        {ka.nav.searchPlaceholder}
      </label>
      <div className="relative flex min-w-0 items-center rounded-full border border-[#e3e8e5] bg-[#f3f5f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus-within:border-brand/35 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-soft/70">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 text-xl text-brand/75">⌕</span>
        <input
          id={inputId}
          type="search"
          enterKeyHint="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={ka.nav.searchPlaceholder}
          className="h-12 w-full min-w-0 flex-1 rounded-full bg-transparent pl-11 pr-2 text-[16px] text-text outline-none placeholder:text-text-soft/80 md:text-sm"
        />
        <button
          type="submit"
          className="mr-1 inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-accent px-4 text-xs font-black text-brand transition hover:bg-accent-hover hover:text-white"
        >
          {ka.nav.search}
        </button>
      </div>
    </form>
  )
}
