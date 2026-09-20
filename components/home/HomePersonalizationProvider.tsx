"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { MarketplaceUserState } from "@/components/layout/MobileNavigation"
import type { StoryRailData } from "@/types/story"

export const guestMarketplaceUserState: MarketplaceUserState = {
  userId: null,
  signedIn: false,
  profileLabel: "პროფილი",
  profileImage: null,
  isAdmin: false,
  unreadNotifications: 0,
  unreadChats: 0,
}

type HomePersonalizationPayload = {
  userState: MarketplaceUserState
  favoriteIds: string[]
  storyRail: StoryRailData | null
}

type HomePersonalizationContextValue = HomePersonalizationPayload & {
  loaded: boolean
}

const HomePersonalizationContext = createContext<HomePersonalizationContextValue | null>(null)

export function HomePersonalizationProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<HomePersonalizationPayload>({
    userState: guestMarketplaceUserState,
    favoriteIds: [],
    storyRail: null,
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true

    async function loadPersonalization() {
      try {
        const response = await fetch("/api/home-personalization", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        })

        if (!response.ok) return
        const data = (await response.json()) as HomePersonalizationPayload
        if (active) setPayload(data)
      } catch {
        // Keep the public/guest shell usable when personalization is unavailable.
      } finally {
        if (active) setLoaded(true)
      }
    }

    void loadPersonalization()

    return () => {
      active = false
    }
  }, [])

  const value = useMemo<HomePersonalizationContextValue>(
    () => ({ ...payload, loaded }),
    [payload, loaded],
  )

  return (
    <HomePersonalizationContext.Provider value={value}>
      {children}
    </HomePersonalizationContext.Provider>
  )
}

export function useHomePersonalization() {
  return useContext(HomePersonalizationContext)
}
