"use client"

import { useBrowserConsent } from "@/components/privacy/useBrowserConsent"
import { useEffect } from "react"
import { rememberRecentlyViewed } from "@/lib/recently-viewed"

export default function RecentlyViewedTracker({ listingId }: { listingId: string }) {
  const consent = useBrowserConsent()

  useEffect(() => {
    rememberRecentlyViewed(listingId)
  }, [listingId, consent?.personalization])

  useEffect(() => {
    if (consent?.analytics !== true || process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") return
    const controller = new AbortController()
    void fetch("/api/listing-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ listingId }),
      signal: controller.signal,
    }).catch(() => undefined)
    return () => controller.abort()
  }, [listingId, consent?.analytics])

  return null
}
