"use client"

import MarketplaceHeader from "@/components/layout/MarketplaceHeader"
import type { MarketplaceNavItem } from "@/components/layout/MobileNavigation"
import {
  guestMarketplaceUserState,
  useHomePersonalization,
} from "@/components/home/HomePersonalizationProvider"

export default function HomeSiteHeader({ items }: { items: MarketplaceNavItem[] }) {
  const personalization = useHomePersonalization()
  return (
    <MarketplaceHeader
      items={items}
      userState={personalization?.userState ?? guestMarketplaceUserState}
    />
  )
}
