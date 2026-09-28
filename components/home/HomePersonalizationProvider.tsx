"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
  const supabase = useMemo(() => createClient(), [])
  const [payload, setPayload] = useState<HomePersonalizationPayload>({
    userState: guestMarketplaceUserState,
    favoriteIds: [],
    storyRail: null,
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    let refreshTimer: number | null = null

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

    function schedulePersonalizationRefresh() {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        if (active) void loadPersonalization()
      }, 0)
    }

    void loadPersonalization()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setPayload({
          userState: guestMarketplaceUserState,
          favoriteIds: [],
          storyRail: null,
        })
        setLoaded(true)
        return
      }

      if (
        event === "SIGNED_IN"
        || event === "TOKEN_REFRESHED"
        || event === "USER_UPDATED"
      ) {
        schedulePersonalizationRefresh()
      }
    })

    return () => {
      active = false
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      subscription.unsubscribe()
    }
  }, [supabase])

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
