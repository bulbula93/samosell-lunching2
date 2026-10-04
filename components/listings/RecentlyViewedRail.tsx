"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import { activePromotionBadges } from "@/lib/boosts"
import { readRecentlyViewedIds } from "@/lib/recently-viewed"
import { subscribePreferences } from "@/lib/browser-preferences"
import { useBrowserConsent } from "@/components/privacy/useBrowserConsent"
import type { CatalogListing } from "@/types/marketplace"

type RecentlyViewedRailProps = {
  title?: string
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
  return recentlyViewedResultCache.get(requestKey) ?? EMPTY_RECENTLY_VIEWED_RESULT
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

function getRecentlyViewedSnapshot() {
  return JSON.stringify(readRecentlyViewedIds())
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
  title = "ბოლო ნანახი",
  excludeId,
}: RecentlyViewedRailProps) {
  const consent = useBrowserConsent()
  const storedSnapshot = useSyncExternalStore(
    subscribePreferences,
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

  if (!consent?.personalization || (!loading && items.length === 0)) return null

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5f6368]">შენი ისტორია</div>
          <h2 className="mt-1 text-xl font-medium leading-7 text-[#2d2d2d] sm:text-2xl">{title}</h2>
        </div>
        <Link
          href="/catalog"
          className="hidden h-10 items-center justify-center rounded-full border border-[#2d2d2d] bg-white px-4 text-sm font-semibold text-[#2d2d2d] transition hover:bg-[#f5f5f5] sm:inline-flex"
        >
          სრული კატალოგი
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="w-[190px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-[#2d2d2d]/20 bg-white p-3 sm:w-[210px] lg:w-[220px]"
              >
                <div className="aspect-[4/5] animate-pulse rounded-[16px] bg-[#ececec]" />
                <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-[#ececec]" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[#ececec]" />
              </div>
            ))
          : items.map((item) => {
              const badges = activePromotionBadges(item)
              return (
                <article
                  key={item.id}
                  className="group w-[190px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-[#2d2d2d]/25 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(31,12,48,0.08)] sm:w-[210px] lg:w-[220px]"
                >
                  <Link href={`/listing/${item.slug}`} className="block aspect-[4/5] bg-[#ececec]">
                    <SmartImage
                      src={item.cover_image_url}
                      alt={item.title}
                      wrapperClassName="h-full w-full"
                      fallbackLabel="სურათი არ არის"
                    />
                  </Link>
                  <div className="space-y-2 p-3">
                    {badges.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full border border-[#2d2d2d]/20 bg-white px-2 py-0.5 text-[10px] font-semibold text-[#2d2d2d]"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <Link href={`/listing/${item.slug}`} className="block min-w-0">
                      <div className="line-clamp-2 text-sm font-medium text-[#2d2d2d] transition group-hover:text-[#8e3df1] sm:text-base">
                        {item.title}
                      </div>
                      <div className="mt-1 line-clamp-1 text-xs text-[#5f6368]">
                        {[item.brand_name, item.size_label, item.city].filter(Boolean).join(" · ") || item.category_name}
                      </div>
                    </Link>
                    <div className="text-base font-bold text-[#2d2d2d]">
                      {item.price} {item.currency === "GEL" ? "₾" : item.currency}
                    </div>
                  </div>
                </article>
              )
            })}
      </div>
    </section>
  )
}
