import { NextResponse } from "next/server"
import { getUserAvatar } from "@/lib/profiles"
import { getStoryRailData } from "@/lib/story-data"
import { createClient } from "@/lib/supabase/server"
import type { MarketplaceUserState } from "@/components/layout/MobileNavigation"

const guestUserState: MarketplaceUserState = {
  userId: null,
  signedIn: false,
  profileLabel: "პროფილი",
  profileImage: null,
  isAdmin: false,
  unreadNotifications: 0,
  unreadChats: 0,
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const storyRail = process.env.STORIES_UI_DISABLED === "true"
      ? null
      : await getStoryRailData(supabase, null)

    return NextResponse.json(
      { userState: guestUserState, favoriteIds: [], storyRail },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  }

  const [profileResponse, unreadResponse, chatUnreadResponse, favoritesResponse, storyRail] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_admin, avatar_url, full_name, username, store_logo_url, seller_type")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .not("type", "in", "(chat_started,chat_message)"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .in("type", ["chat_started", "chat_message"]),
    supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id),
    process.env.STORIES_UI_DISABLED === "true"
      ? Promise.resolve(null)
      : getStoryRailData(supabase, user),
  ])

  const profile = profileResponse.data
  const userState: MarketplaceUserState = {
    userId: user.id,
    signedIn: true,
    profileLabel: profile?.full_name || profile?.username || "პროფილი",
    profileImage: getUserAvatar(profile),
    isAdmin: Boolean(profile?.is_admin),
    unreadNotifications: unreadResponse.error ? 0 : unreadResponse.count ?? 0,
    unreadChats: chatUnreadResponse.error ? 0 : chatUnreadResponse.count ?? 0,
  }

  return NextResponse.json(
    {
      userState,
      favoriteIds: favoritesResponse.error
        ? []
        : (favoritesResponse.data ?? []).map((item) => item.listing_id),
      storyRail,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  )
}
