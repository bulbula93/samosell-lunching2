"use client"

import { useEffect, useMemo, useSyncExternalStore } from "react"
import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import { useBrowserConsent } from "@/components/privacy/useBrowserConsent"
import { activePromotionBadges } from "@/lib/boosts"
import { subscribePreferences } from "@/lib/browser-preferences"
import { readRecentlyViewedIds } from "@/lib/recently-viewed"
import type { CatalogListing } from "@/types/marketplace"

const EMPTY_RECENT_SNAPSHOT = "[]"

type RecommendationState = {
  key: string
  items: CatalogListing[]
  status: "idle" | "loading" | "ready" | "error"
}

const EMPTY_RESULT: RecommendationState = {
  key: "",
  items: [],
  status: "idle",
}

const resultCache = new Map<string, RecommendationState>()
const listeners = new Set<() => void>()
const requests = new Map<string, Promise<void>>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribeResults(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getResultSnapshot(key: string) {
  if (!key) return EMPTY_RESULT
  return resultCache.get(key) ?? EMPTY_RESULT
}

function ensureResult(key: string, recentIds: string[]) {
  if (!key || requests.has(key)) return

  const cached = resultCache.get(key)
  if (cached?.status === "loading" || cached?.status === "ready") return

  const search = new URLSearchParams()
  if (recentIds.length > 0) search.set("ids", recentIds.join(","))

  resultCache.set(key, { key, items: cached?.items ?? [], status: "loading" })
  emit()

  const suffix = search.size > 0 ? `?${search.toString()}` : ""
  const request = fetch(`/api/recommendations${suffix}`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("fetch_failed")
      return (await response.json()) as { items?: CatalogListing[] }
    })
    .then((payload) => {
      resultCache.set(key, {
        key,
        items: payload.items ?? [],
        status: "ready",
      })
    })
    .catch(() => {
      resultCache.set(key, {
        key,
        items: [],
        status: "error",
      })
    })
    .finally(() => {
      requests.delete(key)
      emit()
    })

  requests.set(key, request)
}

function getRecentSnapshot() {
  return JSON.stringify(readRecentlyViewedIds())
}

function parseRecentSnapshot(snapshot: string) {
  try {
    const parsed = JSON.parse(snapshot)
    if (!Array.isArray(parsed)) return [] as string[]
    return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return [] as string[]
  }
}

export default function RecommendedForYouRail() {
  const consent = useBrowserConsent()
  const recentSnapshot = useSyncExternalStore(
    subscribePreferences,
    getRecentSnapshot,
    () => EMPTY_RECENT_SNAPSHOT,
  )

  const recentIds = useMemo(() => parseRecentSnapshot(recentSnapshot), [recentSnapshot])
  const requestKey = recentIds.length > 0 ? recentIds.join(",") : "account"

  useEffect(() => {
    if (!consent?.personalization) return
    ensureResult(requestKey, recentIds)
  }, [consent?.personalization, recentIds, requestKey])

  const result = useSyncExternalStore(
    subscribeResults,
    () => getResultSnapshot(requestKey),
    () => EMPTY_RESULT,
  )

  const loading = consent?.personalization && result.status === "loading"
  const items = result.key === requestKey ? result.items : []

  if (!consent?.personalization || (!loading && items.length === 0)) return null

  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 pb-10 sm:px-6 sm:pb-16 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5f6368]">
            შენთვის შერჩეული
          </div>
          <h2 className="mt-2 text-2xl font-medium leading-8 text-[#2d2d2d] sm:text-[2rem]">
            შენი ინტერესების მიხედვით
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f6368]">
            რეკომენდაციები ეყრდნობა შენს ბოლო ნანახ ნივთებსა და რჩეულებს — კატეგორიის, ბრენდის, ზომის, ფასისა და სხვა მსგავსების სიგნალებით.
          </p>
        </div>
        <Link
          href="/catalog"
          className="inline-flex h-11 shrink-0 items-center justify-center self-start rounded-full border border-[#2d2d2d] bg-white px-4 text-sm font-semibold text-[#2d2d2d] transition hover:bg-[#f5f5f5] sm:self-auto"
        >
          ნახე მეტი
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:gap-5">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="w-[220px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-[#2d2d2d]/20 bg-white p-3 sm:w-[240px] lg:w-[250px]"
              >
                <div className="aspect-[4/5] animate-pulse rounded-[18px] bg-[#ececec]" />
                <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-[#ececec]" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[#ececec]" />
              </div>
            ))
          : items.map((item) => {
              const badges = activePromotionBadges(item)
              return (
                <article
                  key={item.id}
                  className="group w-[220px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-[#2d2d2d]/25 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(31,12,48,0.09)] sm:w-[240px] lg:w-[250px]"
                >
                  <Link href={`/listing/${item.slug}`} className="block aspect-[4/5] bg-[#ececec]">
                    <SmartImage
                      src={item.cover_image_url}
                      alt={item.title}
                      wrapperClassName="h-full w-full"
                      fallbackLabel="სურათი არ არის"
                    />
                  </Link>
                  <div className="space-y-2.5 p-3.5">
                    {badges.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full border border-[#2d2d2d]/20 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-[#2d2d2d]"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <Link href={`/listing/${item.slug}`} className="block min-w-0">
                      <div className="line-clamp-2 text-base font-medium text-[#2d2d2d] transition group-hover:text-[#8e3df1]">
                        {item.title}
                      </div>
                      <div className="mt-1 line-clamp-1 text-xs text-[#5f6368]">
                        {[item.brand_name, item.size_label, item.city].filter(Boolean).join(" · ") || item.category_name}
                      </div>
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-bold text-[#2d2d2d]">
                        {item.price} {item.currency === "GEL" ? "₾" : item.currency}
                      </span>
                      {(item.favorites_count ?? 0) > 0 ? (
                        <span className="rounded-full bg-[#f4f4f4] px-2.5 py-1 text-[10px] font-semibold text-[#5f6368]">
                          {item.favorites_count} ♥
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })}
      </div>
    </section>
  )
}
