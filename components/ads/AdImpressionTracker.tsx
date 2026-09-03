"use client"

import { useEffect } from "react"
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
  useEffect(() => {
    void fetch("/api/ads/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adId, placementKey, pagePath, eventType: "impression" }),
      cache: "no-store",
      keepalive: true,
    }).catch(() => undefined)
  }, [adId, pagePath, placementKey])

  return null
}
