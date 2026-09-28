"use client"

import { useEffect, useRef } from "react"
import type { AdPlacementKey } from "@/lib/ads"

export default function AdImpressionTracker({
  adId,
  placementKey,
  pagePath,
}: {
  adId: string
  placementKey: AdPlacementKey
  pagePath: string
}) {
  const markerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return

    let sent = false
    const send = () => {
      if (sent) return
      sent = true
      void fetch("/api/ads/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adId, placementKey, pagePath, eventType: "impression" }),
        cache: "no-store",
        keepalive: true,
      }).catch(() => undefined)
    }

    if (typeof IntersectionObserver !== "function") {
      send()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
          send()
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [adId, pagePath, placementKey])

  return <span ref={markerRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
}
