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
      <div className="relative flex min-w-0 items-center gap-2 rounded-full border border-[#e3e8e5] bg-[#f3f5f4] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/30">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 text-xl text-brand/75">⌕</span>
        <input
          id={inputId}
          type="search"
          enterKeyHint="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={ka.nav.searchPlaceholder}
          className="h-10 w-0 min-w-0 flex-1 rounded-full bg-transparent pl-10 pr-1 text-[16px] text-text placeholder:text-text-soft/80 md:text-sm"
          // The shared focus outline belongs on the entire search control.
          style={{ outline: "none" }}
        />
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-accent px-4 text-sm font-black text-brand transition hover:bg-accent-hover hover:text-white"
          style={{ outlineOffset: "-3px" }}
        >
          {ka.nav.search}
        </button>
      </div>
    </form>
  )
}
