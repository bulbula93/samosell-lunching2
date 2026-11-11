"use client"

import Link from "next/link"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ka } from "@/lib/i18n/ka"
import {
  getMarketplaceSearchSuggestions,
  type MarketplaceSearchSuggestion,
} from "@/lib/search-suggestions"

const RECENT_SEARCHES_KEY = "samosell:recent-searches"
const MAX_RECENT_SEARCHES = 5

function normalizeRecentSearch(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120)
}

function readRecentSearches() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeRecentSearch(String(item ?? "")))
      .filter(Boolean)
      .slice(0, MAX_RECENT_SEARCHES)
  } catch {
    return []
  }
}

function saveRecentSearch(query: string, current: string[]) {
  const normalized = normalizeRecentSearch(query)
  if (!normalized) return current

  const next = [
    normalized,
    ...current.filter((item) => item.toLocaleLowerCase("ka-GE") !== normalized.toLocaleLowerCase("ka-GE")),
  ].slice(0, MAX_RECENT_SEARCHES)

  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
  } catch {
    // Search remains functional when storage is unavailable.
  }

  return next
}

function SuggestionIcon({ kind }: { kind: MarketplaceSearchSuggestion["kind"] }) {
  return (
    <span
      aria-hidden="true"
      className={
        kind === "brand"
          ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-black text-brand"
          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-sm font-black text-[#b75a18]"
      }
    >
      {kind === "brand" ? "B" : "⌂"}
    </span>
  )
}

export default function MarketplaceSearch({
  defaultValue = "",
  compact = false,
  id,
}: {
  defaultValue?: string
  compact?: boolean
  id?: string
}) {
  const generatedId = useId()
  const inputId = id || (compact ? `mobile-marketplace-search-${generatedId}` : `marketplace-search-${generatedId}`)
  const rootRef = useRef<HTMLFormElement | null>(null)
  const [query, setQuery] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  const [previousDefault, setPreviousDefault] = useState(defaultValue)
  if (previousDefault !== defaultValue) {
    setPreviousDefault(defaultValue)
    setQuery(defaultValue)
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!rootRef.current?.contains(target)) setOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [])

  const suggestions = useMemo(
    () => getMarketplaceSearchSuggestions(query, query.trim() ? 8 : 6),
    [query],
  )

  const hasQuery = Boolean(query.trim())
  const showPanel = open && (hasQuery || recentSearches.length > 0 || suggestions.length > 0)

  function rememberSearch(value: string) {
    setRecentSearches((current) => saveRecentSearch(value, current))
  }

  function clearRecentSearches() {
    setRecentSearches([])
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY)
    } catch {
      // No-op when storage is unavailable.
    }
  }

  return (
    <form
      ref={rootRef}
      action="/catalog"
      role="search"
      className="relative z-[70] w-full min-w-0 max-w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        const input = rootRef.current?.querySelector<HTMLInputElement>('input[name="q"]')
        if (event.key === "Escape" && showPanel) {
          event.preventDefault()
          event.stopPropagation()
          input?.focus()
          setOpen(false)
          return
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
        const links = Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>("[data-search-suggestions] a[href]") ?? [])
        const index = links.indexOf(event.target as HTMLAnchorElement)
        if (event.target !== input && index < 0) return
        event.preventDefault()
        if (!showPanel) {
          setRecentSearches(readRecentSearches())
          setOpen(true)
          return
        }
        if (!links.length) return
        if (event.key === "ArrowDown") {
          if (index === links.length - 1) input?.focus()
          else links[index + 1]?.focus()
        } else if (index === 0) input?.focus()
        else links[index < 0 ? links.length - 1 : index - 1]?.focus()
      }}
      onSubmit={() => {
        rememberSearch(query)
        setOpen(false)
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        {ka.nav.searchPlaceholder}
      </label>

      <div className="relative flex min-w-0 items-center gap-2 rounded-full border border-[#e3e8e5] bg-[#f3f5f4] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/30">
        <span aria-hidden="true" className="pointer-events-none absolute left-4 text-xl text-brand/75">⌕</span>
        <input
          id={inputId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          name="q"
          value={query}
          onFocus={() => { setRecentSearches(readRecentSearches()); setOpen(true) }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          placeholder={ka.nav.searchPlaceholder}
          className="h-11 w-0 min-w-0 flex-1 rounded-full bg-transparent pl-10 pr-1 text-[16px] text-text placeholder:text-text-soft/80 md:text-sm [&::-webkit-search-cancel-button]:appearance-none"
          aria-controls={showPanel ? `${inputId}-suggestions` : undefined}
          aria-describedby={showPanel ? `${inputId}-help` : undefined}
          style={{ outline: "none" }}
        />
        {hasQuery ? (
          <button
            type="button"
            aria-label="საძიებო ტექსტის გასუფთავება"
            onClick={() => {
              setQuery("")
              rootRef.current?.querySelector<HTMLInputElement>('input[name="q"]')?.focus()
              setOpen(true)
            }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-text-soft transition hover:bg-brand-soft hover:text-brand"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-accent px-4 text-sm font-black text-brand transition hover:bg-accent-hover hover:text-white"
          style={{ outlineOffset: "-3px" }}
        >
          {ka.nav.search}
        </button>
      </div>

      {showPanel ? (
        <div
          id={`${inputId}-suggestions`}
          data-search-suggestions
          className="absolute inset-x-0 top-[calc(100%+8px)] overflow-hidden rounded-[1.35rem] border border-line bg-white shadow-[0_22px_54px_rgba(7,63,59,0.16)]"
        >
          <p id={`${inputId}-help`} className="sr-only">მინიშნებებზე გადასასვლელად გამოიყენე ზედა და ქვედა ისრები. Enter ხსნის არჩევანს, Escape ხურავს მინიშნებებს.</p>
          <div className="max-h-[min(68vh,420px)] overflow-y-auto p-2">
            {!hasQuery && recentSearches.length > 0 ? (
              <section className="pb-2">
                <div className="flex items-center justify-between px-2 pb-1 pt-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.13em] text-text-soft">
                    ბოლო ძიებები
                  </p>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="min-h-9 rounded-lg px-2 text-xs font-semibold text-brand transition hover:bg-brand-soft"
                  >
                    გასუფთავება
                  </button>
                </div>
                <div className="space-y-0.5">
                  {recentSearches.map((item) => (
                    <Link
                      key={item}
                      href={`/catalog?q=${encodeURIComponent(item)}`}
                      onClick={() => {
                        rememberSearch(item)
                        setOpen(false)
                      }}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-text transition hover:bg-brand-soft/55"
                    >
                      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-alt text-text-soft">↺</span>
                      <span className="min-w-0 flex-1 truncate">{item}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {hasQuery ? (
              <Link
                href={`/catalog?q=${encodeURIComponent(normalizeRecentSearch(query))}`}
                onClick={() => {
                  rememberSearch(query)
                  setOpen(false)
                }}
                className="mb-2 flex min-h-12 items-center gap-3 rounded-xl bg-brand-soft/55 px-3 text-sm font-black text-brand transition hover:bg-brand-soft"
              >
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white">⌕</span>
                <span className="min-w-0 flex-1 truncate">მოძებნე „{normalizeRecentSearch(query)}“</span>
                <span aria-hidden="true">→</span>
              </Link>
            ) : null}

            {suggestions.length > 0 ? (
              <section>
                <p className="px-2 pb-1 pt-1 text-[11px] font-black uppercase tracking-[0.13em] text-text-soft">
                  {hasQuery ? "შესაძლო დამთხვევები" : "პოპულარული არჩევანი"}
                </p>
                <div className="space-y-0.5">
                  {suggestions.map((item) => (
                    <Link
                      key={`${item.kind}:${item.label}`}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left transition hover:bg-brand-soft/55"
                    >
                      <SuggestionIcon kind={item.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-text">{item.label}</span>
                        <span className="mt-0.5 block text-[11px] font-semibold text-text-soft">
                          {item.kind === "brand" ? "ბრენდი" : "კატეგორია"}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-sm text-text-soft">→</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : hasQuery ? (
              <div className="px-4 py-5 text-center">
                <p className="text-sm font-bold text-text">მსგავსი ბრენდი ან კატეგორია ვერ მოიძებნა</p>
                <p className="mt-1 text-xs leading-5 text-text-soft">
                  სცადე ნივთის სახელით ძიება ან შეცვალე საძიებო სიტყვა.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </form>
  )
}
