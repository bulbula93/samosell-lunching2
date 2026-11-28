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

// The header must never stay on its loading skeleton because the database is slow.
const PERSONALIZATION_TIMEOUT_MS = 8000

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
    let generation = 0
    let request: AbortController | null = null
    const reset = () => setPayload({ userState: guestMarketplaceUserState, favoriteIds: [], storyRail: null })

    // Show the signed-in header straight from the locally stored session so it
    // never waits on the database; the API response below then fills in the
    // profile photo, admin flag and unread counts.
    async function applyLocalSession(current: number) {
      try {
        const result = await supabase.auth.getSession?.()
        const user = result?.data?.session?.user
        if (!user || !active || current !== generation) return
        const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
        const label = [metadata.full_name, metadata.name, metadata.user_name].find(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
        const avatar = [metadata.avatar_url, metadata.picture].find(
          (value): value is string => typeof value === "string" && value.startsWith("https://"),
        )
        setPayload((previous) => previous.userState.userId === user.id ? previous : {
          userState: {
            ...guestMarketplaceUserState,
            userId: user.id,
            signedIn: true,
            profileLabel: label ?? guestMarketplaceUserState.profileLabel,
            profileImage: avatar ?? null,
          },
          favoriteIds: [],
          storyRail: null,
        })
        setLoaded(true)
      } catch {
        // No readable local session: wait for the API response.
      }
    }

    async function loadPersonalization() {
      const current = ++generation
      request?.abort()
      const controller = new AbortController()
      request = controller
      const timeout = window.setTimeout(() => controller.abort(), PERSONALIZATION_TIMEOUT_MS)
      void applyLocalSession(current)
      try {
        const response = await fetch("/api/home-personalization", {
          cache: "no-store",
          signal: controller.signal,
          credentials: "same-origin",
          headers: { accept: "application/json" },
        })

        if (!response.ok) return
        const data = (await response.json()) as HomePersonalizationPayload
        if (active && current === generation) setPayload(data)
      } catch {
        // Keep the public/guest shell usable when personalization is unavailable.
      } finally {
        window.clearTimeout(timeout)
        if (active && current === generation) setLoaded(true)
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
        generation++
        request?.abort()
        if (refreshTimer !== null) window.clearTimeout(refreshTimer)
        reset()
        setLoaded(true)
        return
      }

      if (
        event === "SIGNED_IN"
        || event === "TOKEN_REFRESHED"
        || event === "USER_UPDATED"
      ) {
        generation++
        request?.abort()
        reset()
        setLoaded(false)
        schedulePersonalizationRefresh()
      }
    })

    return () => {
      active = false
      generation++
      request?.abort()
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
