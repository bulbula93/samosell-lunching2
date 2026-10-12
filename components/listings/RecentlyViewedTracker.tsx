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
    if (process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") return
    if (consent?.analytics !== true) return
    void fetch("/api/listing-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ listingId }),
    }).catch(() => undefined)
  }, [listingId, consent?.analytics])

  return null
}
