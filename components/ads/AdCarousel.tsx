"use client"

import { useExpiryClock } from "@/components/shared/useExpiryClock"
import { isAdActive } from "@/lib/ads"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import AdBanner from "@/components/ads/AdBanner"
import type { AdRecord } from "@/lib/ads"

const ROTATION_MS = 6000

/**
 * Home ad slot policy: exactly one ad is visible at a time, full width.
 * Up to HOME_AD_ROTATION_LIMIT paid ads share the slot (enforced at approval
 * time in approve_self_service_ad). Each page view starts on a random ad so
 * every advertiser gets an equal share of first impressions. With no live
 * paid ad the slot renders nothing instead of an "advertise here" filler.
 */
export default function AdCarousel({ ads, pagePath }: { ads: AdRecord[]; pagePath: string }) {
  const now = useExpiryClock(ads.flatMap((ad) => [ad.starts_at, ad.ends_at]))
  const ordered = useMemo(
    () => ads.filter((ad) => now === null || isAdActive(ad, new Date(now))).sort((a, b) => a.id.localeCompare(b.id)),
    [ads, now],
  )
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)

  // Randomize the starting ad after hydration so server and client markup match.
  useEffect(() => {
    if (ordered.length <= 1) return
    const frame = window.requestAnimationFrame(() => setIndex(Math.floor(Math.random() * ordered.length)))
    return () => window.cancelAnimationFrame(frame)
  }, [ordered.length])

  const move = useCallback((step: number) => {
    if (!ordered.length) return
    setIndex((current) => (current + step + ordered.length) % ordered.length)
  }, [ordered.length])

  useEffect(() => {
    if (ordered.length <= 1 || paused) return
    const timer = window.setInterval(() => move(1), ROTATION_MS)
    return () => window.clearInterval(timer)
  }, [move, ordered.length, paused])

  if (!ordered.length) return null
  const current = ordered[index % ordered.length]

  return (
    <section aria-label="რეკლამა" data-home-top-ad className="bg-bg py-6 sm:py-8">
      <div
        className="ui-container"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const delta = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(delta) > 40) move(delta < 0 ? 1 : -1)
          touchX.current = null
        }}
      >
        <div key={current.id}>
          <AdBanner ad={current} pagePath={pagePath} variant="wide" />
        </div>
        {ordered.length > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-2" role="group" aria-label="რეკლამის არჩევა">
            {ordered.map((ad, position) => (
              <button
                key={ad.id}
                type="button"
                aria-label={`რეკლამა ${position + 1} / ${ordered.length}`}
                aria-current={position === index % ordered.length ? "true" : undefined}
                onClick={() => setIndex(position)}
                className="flex h-11 w-11 items-center justify-center"
              >
                <span className={`block h-2 rounded-full transition-all ${position === index % ordered.length ? "w-6 bg-brand" : "w-2 bg-brand/25"}`} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
