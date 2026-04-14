"use client"

import { useEffect } from "react"
import { rememberRecentlyViewed } from "@/lib/recently-viewed"

export default function RecentlyViewedTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    rememberRecentlyViewed(listingId)
  }, [listingId])

  return null
}
