import { NextResponse } from "next/server"
import { getUserAvatar } from "@/lib/profiles"
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

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie" }

// Header/favorites state for the cached homepage. Kept deliberately light:
// - the user id comes from the verified JWT claims (getClaims), not from an
//   Auth server round-trip per page view;
// - the story rail is no longer computed here. No client component reads it,
//   and its query was the one hitting statement timeouts on the free-tier
//   database, which left the header stuck on its loading skeleton.
export async function GET() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null

  if (!userId) {
    return NextResponse.json(
      { userState: guestUserState, favoriteIds: [], storyRail: null },
      { headers: privateHeaders },
    )
  }

  const [profileResponse, unreadResponse, chatUnreadResponse, favoritesResponse] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_admin, avatar_url, full_name, username, store_logo_url, seller_type")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .not("type", "in", "(chat_started,chat_message)"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .in("type", ["chat_started", "chat_message"]),
    supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", userId),
  ])

  const profile = profileResponse.data
  const userState: MarketplaceUserState = {
    userId,
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
      storyRail: null,
    },
    { headers: privateHeaders },
  )
}
