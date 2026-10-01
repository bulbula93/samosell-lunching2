"use client"

import { useBrowserConsent } from "@/components/privacy/useBrowserConsent"
import { useEffect } from "react"
import { rememberRecentlyViewed } from "@/lib/recently-viewed"

export default function RecentlyViewedTracker({ listingId }: { listingId: string }) {
  const consent = useBrowserConsent()
  useEffect(() => {
    rememberRecentlyViewed(listingId)
  }, [listingId, consent?.personalization])

  return null
}
