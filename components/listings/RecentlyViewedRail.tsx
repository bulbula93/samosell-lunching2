"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import { activePromotionBadges } from "@/lib/boosts"
import { RECENTLY_VIEWED_STORAGE_KEY } from "@/lib/recently-viewed"
import type { CatalogListing } from "@/types/marketplace"

type RecentlyViewedRailProps = {
  title?: string
  emptyText?: string
  excludeId?: string
}

const EMPTY_RECENTLY_VIEWED_SNAPSHOT = "[]"

type RecentlyViewedRequestState = {
  key: string
  items: CatalogListing[]
  status: "idle" | "loading" | "ready" | "error"
}

const EMPTY_RECENTLY_VIEWED_RESULT: RecentlyViewedRequestState = {
  key: "",
  items: [],
  status: "idle",
}

const recentlyViewedResultCache = new Map<string, RecentlyViewedRequestState>()
const recentlyViewedListeners = new Set<() => void>()
const recentlyViewedRequests = new Map<string, Promise<void>>()

function emitRecentlyViewedResults() {
  recentlyViewedListeners.forEach((listener) => listener())
}

function subscribeRecentlyViewedResults(listener: () => void) {
  recentlyViewedListeners.add(listener)
  return () => {
    recentlyViewedListeners.delete(listener)
  }
}

function getRecentlyViewedResultSnapshot(requestKey: string) {
  if (!requestKey) return EMPTY_RECENTLY_VIEWED_RESULT
  return recentlyViewedResultCache.get(requestKey) ?? { key: requestKey, items: [], status: "idle" as const }
}

function ensureRecentlyViewedResult(requestKey: string) {
  if (!requestKey || recentlyViewedRequests.has(requestKey)) return

  const cached = recentlyViewedResultCache.get(requestKey)
  if (cached?.status === "loading" || cached?.status === "ready") return

  const search = new URLSearchParams({ ids: requestKey })
  recentlyViewedResultCache.set(requestKey, { key: requestKey, items: cached?.items ?? [], status: "loading" })
  emitRecentlyViewedResults()

  const request = fetch(`/api/recently-viewed?${search.toString()}`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("fetch_failed")
      return (await response.json()) as { items?: CatalogListing[] }
    })
    .then((payload) => {
      recentlyViewedResultCache.set(requestKey, {
        key: requestKey,
        items: payload.items ?? [],
        status: "ready",
      })
    })
    .catch(() => {
      recentlyViewedResultCache.set(requestKey, {
        key: requestKey,
        items: [],
        status: "error",
      })
    })
    .finally(() => {
      recentlyViewedRequests.delete(requestKey)
      emitRecentlyViewedResults()
    })

  recentlyViewedRequests.set(requestKey, request)
}

function subscribeRecentlyViewed(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const handleChange = () => onStoreChange()
  window.addEventListener("storage", handleChange)
  window.addEventListener("recently-viewed-updated", handleChange as EventListener)
  return () => {
    window.removeEventListener("storage", handleChange)
    window.removeEventListener("recently-viewed-updated", handleChange as EventListener)
  }
}

function getRecentlyViewedSnapshot() {
  if (typeof window === "undefined") return EMPTY_RECENTLY_VIEWED_SNAPSHOT
  return window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY) ?? EMPTY_RECENTLY_VIEWED_SNAPSHOT
}

function parseRecentlyViewedSnapshot(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot)
    if (!Array.isArray(parsed)) return [] as string[]
    return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return [] as string[]
  }
}

export default function RecentlyViewedRail({
  title = "ბოლოს ნანახი ნივთები",
  emptyText = "აქ გამოჩნდება ნივთები, რომლებსაც ბოლოს დაათვალიერებ.",
  excludeId,
}: RecentlyViewedRailProps) {
  const storedSnapshot = useSyncExternalStore(
    subscribeRecentlyViewed,
    getRecentlyViewedSnapshot,
    () => EMPTY_RECENTLY_VIEWED_SNAPSHOT
  )

  const listingIds = useMemo(() => {
    return parseRecentlyViewedSnapshot(storedSnapshot).filter((id) => id && id !== excludeId)
  }, [excludeId, storedSnapshot])

  const requestKey = listingIds.join(",")

  useEffect(() => {
    ensureRecentlyViewedResult(requestKey)
  }, [requestKey])

  const result = useSyncExternalStore(
    subscribeRecentlyViewedResults,
    () => getRecentlyViewedResultSnapshot(requestKey),
    () => EMPTY_RECENTLY_VIEWED_RESULT
  )

  const loading = result.status === "loading"
  const items = result.key === requestKey ? result.items : []

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-6 sm:pb-16 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5f6368]">შენთვის შერჩეული</div>
          <h2 className="mt-2 text-2xl font-medium leading-8 text-[#2d2d2d] sm:text-[2rem]">{title}</h2>
        </div>
        <Link
          href="/catalog"
          className="inline-flex h-11 items-center justify-center rounded-full border border-[#2d2d2d] bg-white px-4 text-sm font-semibold text-[#2d2d2d] transition hover:bg-[#f5f5f5]"
        >
          სრული კატალოგი
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[24px] border border-[#2d2d2d] bg-white p-4">
              <div className="aspect-[4/5] animate-pulse rounded-[20px] bg-[#ececec]" />
              <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[#ececec]" />
              <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-[#ececec]" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {items.map((item) => {
            const badges = activePromotionBadges(item)
            return (
              <article key={item.id} className="group overflow-hidden rounded-[24px] border border-[#2d2d2d] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(31,12,48,0.08)]">
                <Link href={`/listing/${item.slug}`} className="block aspect-[4/5] bg-[#ececec]">
                  <SmartImage src={item.cover_image_url} alt={item.title} wrapperClassName="h-full w-full" fallbackLabel="სურათი არ არის" />
                </Link>
                <div className="space-y-3 p-4">
                  {badges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {badges.map((badge) => (
                        <span key={badge} className="rounded-full border border-[#2d2d2d] bg-white px-3 py-1 text-[11px] font-semibold text-[#2d2d2d]">
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <Link href={`/listing/${item.slug}`} className="block min-w-0">
                    <div className="line-clamp-2 text-base font-medium text-[#2d2d2d] transition group-hover:text-[#8e3df1] sm:text-lg">{item.title}</div>
                    <div className="mt-1 line-clamp-1 text-sm text-[#5f6368]">
                      {[item.brand_name, item.size_label, item.city].filter(Boolean).join(" · ") || item.category_name}
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-lg font-bold text-[#2d2d2d]">{item.price} {item.currency === "GEL" ? "₾" : item.currency}</span>
                    {(item.favorites_count ?? 0) > 0 ? <span className="rounded-full border border-[#2d2d2d]/15 bg-[#f4f4f4] px-3 py-1 text-[11px] font-semibold text-[#5f6368]">{item.favorites_count} ფავორიტი</span> : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-[32px] border border-dashed border-[#2d2d2d] bg-white p-8">
          <div className="text-2xl font-semibold text-[#2d2d2d]">ბოლოს ნანახი ჯერ ცარიელია</div>
          <p className="mt-3 max-w-2xl leading-7 text-[#5f6368]">{emptyText}</p>
          <div className="mt-6">
            <Link href="/catalog" className="inline-flex h-12 items-center justify-center rounded-full border border-[#2d2d2d] bg-[#8e3df1] px-5 text-sm font-semibold text-white transition hover:bg-[#7b2fe0]">
              კატალოგის ნახვა
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
