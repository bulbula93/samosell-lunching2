"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import CatalogFilterFields, {
  type CatalogFilterOptions,
  type CatalogFilterValues,
} from "@/components/listings/CatalogFilterFields"
import { ka } from "@/lib/i18n/ka"

type MobilePanel = "filters" | "sort" | null

const SORT_OPTIONS = [
  { value: "latest", label: "ახლახან დამატებული" },
  { value: "popular", label: "პოპულარული" },
  { value: "price_asc", label: "ფასი: დაბლიდან მაღლა" },
  { value: "price_desc", label: "ფასი: მაღლიდან დაბლა" },
  { value: "vip", label: "VIP და გამორჩეული" },
] as const

const RELEVANCE_OPTION = { value: "relevance", label: "ყველაზე შესაბამისი" } as const

function buildCatalogHref(values: CatalogFilterValues, nextSort: string) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(values)) {
    if (!value || key === "sort") continue
    params.set(key, value)
  }

  if (nextSort && nextSort !== "latest") params.set("sort", nextSort)

  const query = params.toString()
  return query ? `/catalog?${query}` : "/catalog"
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4v16M8 4 5 7M8 4l3 3M16 20V4m0 16-3-3m3 3 3-3" />
    </svg>
  )
}

export default function MobileFiltersDrawer({
  options,
  values,
  activeCount,
}: {
  options: CatalogFilterOptions
  values: CatalogFilterValues
  activeCount: number
}) {
  const [panel, setPanel] = useState<MobilePanel>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null)
  const sortTriggerRef = useRef<HTMLButtonElement | null>(null)

  const sortOptions = values.q ? [RELEVANCE_OPTION, ...SORT_OPTIONS] : SORT_OPTIONS
  const currentSort = values.sort || (values.q ? "relevance" : "latest")
  const currentSortLabel =
    sortOptions.find((option) => option.value === currentSort)?.label ?? "ახლახან დამატებული"

  useEffect(() => {
    if (!panel) return

    const trigger = panel === "filters" ? filterTriggerRef.current : sortTriggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setPanel(null)
        return
      }

      if (event.key !== "Tab" || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable.at(-1)

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
      trigger?.focus()
    }
  }, [panel])

  return (
    <div className="lg:hidden">
      <div className="grid grid-cols-2 gap-2.5">
        <button
          ref={filterTriggerRef}
          type="button"
          onClick={() => setPanel("filters")}
          aria-haspopup="dialog"
          aria-expanded={panel === "filters"}
          className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl border border-line bg-white px-3.5 text-left shadow-[0_6px_18px_rgba(7,63,59,0.05)] transition active:scale-[0.98]"
        >
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
            <FilterIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text">{ka.catalog.filters}</span>
            <span className="mt-0.5 block truncate text-[11px] text-text-soft">
              {activeCount > 0 ? `${activeCount} აქტიური` : "აირჩიე ფილტრები"}
            </span>
          </span>
          {activeCount > 0 ? (
            <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-black text-white">
              {activeCount}
            </span>
          ) : null}
        </button>

        <button
          ref={sortTriggerRef}
          type="button"
          onClick={() => setPanel("sort")}
          aria-haspopup="dialog"
          aria-expanded={panel === "sort"}
          className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl border border-line bg-white px-3.5 text-left shadow-[0_6px_18px_rgba(7,63,59,0.05)] transition active:scale-[0.98]"
        >
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fff0df] text-[#c35f19]">
            <SortIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-text">დალაგება</span>
            <span className="mt-0.5 block truncate text-[11px] text-text-soft">{currentSortLabel}</span>
          </span>
        </button>
      </div>

      {panel ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label={panel === "filters" ? "ფილტრების დახურვა" : "დალაგების დახურვა"}
            className="absolute inset-0 bg-text/35 backdrop-blur-[2px]"
            onClick={() => setPanel(null)}
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-catalog-panel-title"
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-[30px] border-t border-line bg-bg shadow-[0_-24px_60px_rgba(7,63,59,0.22)]"
          >
            <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line" />

            <div className="flex items-center justify-between px-5 pb-3 pt-3">
              <div>
                <h2 id="mobile-catalog-panel-title" className="text-xl font-black text-text">
                  {panel === "filters" ? ka.catalog.filters : "დალაგება"}
                </h2>
                <p className="mt-1 text-xs text-text-soft">
                  {panel === "filters"
                    ? activeCount > 0
                      ? `${activeCount} ფილტრი აქტიურია`
                      : "შეარჩიე სასურველი პარამეტრები"
                    : "აირჩიე შედეგების თანმიმდევრობა"}
                </p>
              </div>

              <button
                ref={closeRef}
                type="button"
                onClick={() => setPanel(null)}
                aria-label={panel === "filters" ? "ფილტრების დახურვა" : "დალაგების დახურვა"}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-2xl text-text"
              >
                ×
              </button>
            </div>

            {panel === "filters" ? (
              <form action="/catalog" className="max-h-[calc(88dvh-88px)] overflow-y-auto px-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {values.q ? <input type="hidden" name="q" value={values.q} /> : null}

                <div className="pb-24 pt-2">
                  <CatalogFilterFields
                    key={`${values.category}:${values.item_type}:${values.size}`}
                    options={options}
                    values={values}
                    mobile
                    hideSort
                  />
                </div>

                <div
                  className="sticky bottom-0 -mx-5 grid grid-cols-2 gap-3 border-t border-line bg-bg/95 px-5 pt-4 backdrop-blur"
                  style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
                >
                  <Link
                    href={values.q ? `/catalog?q=${encodeURIComponent(values.q)}` : "/catalog"}
                    className="ui-btn-secondary"
                    onClick={() => setPanel(null)}
                  >
                    {ka.catalog.clear}
                  </Link>
                  <button type="submit" className="ui-btn-primary">{ka.catalog.apply}</button>
                </div>
              </form>
            ) : (
              <div
                className="max-h-[calc(88dvh-88px)] overflow-y-auto px-5 pb-5"
                style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
              >
                <div className="space-y-2 pt-2">
                  {sortOptions.map((option) => {
                    const active = option.value === currentSort

                    return (
                      <Link
                        key={option.value}
                        href={buildCatalogHref(values, option.value)}
                        onClick={() => setPanel(null)}
                        className={`flex min-h-13 items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          active
                            ? "border-brand/25 bg-brand-soft text-brand"
                            : "border-line bg-white text-text hover:border-brand/25 hover:bg-brand-soft/35"
                        }`}
                      >
                        <span>{option.label}</span>
                        <span
                          aria-hidden="true"
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                            active
                              ? "border-brand bg-brand text-white"
                              : "border-line bg-surface-alt text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
