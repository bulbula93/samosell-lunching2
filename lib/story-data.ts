import "server-only"

import type { SupabaseClient, User } from "@supabase/supabase-js"
import { STORY_RAIL_LIMIT } from "@/lib/stories"
import type { StoryComposerListing, StoryItem, StoryOwner, StoryRailData } from "@/types/story"

type StoryRow = {
  id: string
  user_id: string
  media_path: string
  media_type: "image" | "video"
  caption: string | null
  linked_listing_id: string | null
  created_at: string
  expires_at: string
  duration_ms: number | null
}

export async function getStoryRailData(
  supabase: SupabaseClient,
  user: User | null,
): Promise<StoryRailData> {
  const now = new Date().toISOString()
  const { data: storyRows, error } = await supabase
    .from("stories")
    .select("id, user_id, created_at, media_type, expires_at")
    .is("deleted_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(240)

  if (error) {
    // The feature branch can render safely before its migration reaches a test environment.
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { owners: [], currentUserId: user?.id ?? null, currentUsername: null, composerListings: [], ownStats: null }
    }
    throw new Error(`story_rail_failed:${error.message}`)
  }

  const rows = (storyRows ?? []) as Array<Pick<StoryRow, "id" | "user_id" | "created_at" | "media_type" | "expires_at">>
  const ownerIds = [...new Set(rows.map((row) => row.user_id))]
  const storyIds = rows.map((row) => row.id)
  const [profilesResponse, seenResponse, followsResponse, favoriteResponse, chatsResponse, ownListingsResponse, interactionsResponse, statsResponse] = await Promise.all([
    ownerIds.length
      ? supabase.from("profiles").select("id, username, full_name, avatar_url, store_logo_url, seller_type").in("id", ownerIds).eq("is_suspended", false)
      : Promise.resolve({ data: [], error: null }),
    user && storyIds.length
      ? supabase.from("story_views").select("story_id").eq("viewer_id", user.id).in("story_id", storyIds)
      : Promise.resolve({ data: [], error: null }),
    user && ownerIds.length
      ? supabase.from("user_follows").select("following_id").eq("follower_id", user.id).in("following_id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    user
      ? supabase.from("favorites").select("listing:listings!inner(seller_id, category_id, brand_id)").eq("user_id", user.id).limit(300)
      : Promise.resolve({ data: [], error: null }),
    user
      ? supabase.from("chats").select("buyer_id, seller_id").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).limit(300)
      : Promise.resolve({ data: [], error: null }),
    user
      ? supabase.from("listings").select("id, title, slug, price, currency, cover_image_url").eq("seller_id", user.id).eq("status", "active").order("published_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    user
      ? supabase.from("messages").select("story:stories!messages_story_id_fkey(user_id)").eq("sender_id", user.id).eq("message_type", "story_reply").limit(300)
      : Promise.resolve({ data: [], error: null }),
    user ? supabase.rpc("get_my_story_stats") : Promise.resolve({ data: [], error: null }),
  ])

  const profiles = new Map((profilesResponse.data ?? []).map((profile) => [profile.id, profile]))
  const seen = new Set((seenResponse.data ?? []).map((view) => view.story_id))
  const followed = new Set((followsResponse.data ?? []).map((follow) => follow.following_id))
  const favoriteOwners = new Set<string>()
  const favoriteCategories = new Set<number>()
  const favoriteBrands = new Set<string>()
  for (const row of favoriteResponse.data ?? []) {
    const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing
    if (!listing) continue
    if (listing.seller_id) favoriteOwners.add(listing.seller_id)
    if (listing.category_id) favoriteCategories.add(Number(listing.category_id))
    if (listing.brand_id) favoriteBrands.add(listing.brand_id)
  }
  const chatOwners = new Set<string>()
  for (const chat of chatsResponse.data ?? []) {
    if (chat.buyer_id !== user?.id) chatOwners.add(chat.buyer_id)
    if (chat.seller_id !== user?.id) chatOwners.add(chat.seller_id)
  }
  const interactionOwners = new Set<string>()
  for (const row of interactionsResponse.data ?? []) {
    const story = Array.isArray(row.story) ? row.story[0] : row.story
    if (story?.user_id) interactionOwners.add(story.user_id)
  }

  const ownerListingAffinity = new Map<string, number>()
  if (user && ownerIds.length && (favoriteCategories.size || favoriteBrands.size)) {
    const { data: affinityRows } = await supabase
      .from("listings")
      .select("seller_id, category_id, brand_id")
      .in("seller_id", ownerIds)
      .eq("status", "active")
      .limit(500)
    for (const listing of affinityRows ?? []) {
      const categoryMatch = favoriteCategories.has(Number(listing.category_id)) ? 25 : 0
      const brandMatch = listing.brand_id && favoriteBrands.has(listing.brand_id) ? 15 : 0
      ownerListingAffinity.set(listing.seller_id, Math.max(ownerListingAffinity.get(listing.seller_id) ?? 0, categoryMatch + brandMatch))
    }
  }

  const grouped = new Map<string, { ids: string[]; latestAt: string; preview: StoryOwner["preview"] }>()
  for (const row of rows) {
    const group = grouped.get(row.user_id)
    if (group) group.ids.push(row.id)
    else grouped.set(row.user_id, { ids: [row.id], latestAt: row.created_at, preview: { storyId: row.id, mediaType: row.media_type, expiresAt: row.expires_at } })
  }

  const nowMs = Date.now()
  const ranked = Array.from(grouped, ([ownerId, group]): { score: number; owner: StoryOwner } | null => {
    const profile = profiles.get(ownerId)
    if (!profile?.username) return null
    const unseenCount = group.ids.filter((id) => !seen.has(id)).length
    const ageHours = Math.max(0, (nowMs - new Date(group.latestAt).getTime()) / 3_600_000)
    const freshness = Math.max(0, 30 - ageHours * 1.25)
    let score = freshness + (unseenCount > 0 ? 40 : -20) + Math.min(group.ids.length, 5)
    if (followed.has(ownerId)) score += 100
    if (favoriteOwners.has(ownerId)) score += 50
    if (chatOwners.has(ownerId)) score += 30
    if (interactionOwners.has(ownerId)) score += 20
    score += ownerListingAffinity.get(ownerId) ?? 0
    if (ownerId === user?.id) score += 1_000
    const avatarUrl = profile.seller_type === "store" ? profile.store_logo_url || profile.avatar_url : profile.avatar_url
    return {
      score,
      owner: {
        id: ownerId,
        username: profile.username,
        fullName: profile.full_name,
        avatarUrl,
        storyCount: group.ids.length,
        unseenCount,
        latestStoryAt: group.latestAt,
        preview: group.preview,
      } satisfies StoryOwner,
    }
  }).filter((entry): entry is { score: number; owner: StoryOwner } => Boolean(entry))
    .sort((left, right) => right.score - left.score || right.owner.latestStoryAt.localeCompare(left.owner.latestStoryAt))
    .slice(0, STORY_RAIL_LIMIT)

  const currentProfile = user ? profiles.get(user.id) : null
  const composerListings = (ownListingsResponse.data ?? []).map((listing) => ({
    id: listing.id,
    title: listing.title,
    slug: listing.slug,
    price: Number(listing.price),
    currency: listing.currency,
    coverImageUrl: listing.cover_image_url,
  } satisfies StoryComposerListing))

  return {
    owners: ranked.map((entry) => entry.owner),
    currentUserId: user?.id ?? null,
    currentUsername: currentProfile?.username ?? null,
    composerListings,
    ownStats: user ? ((statsResponse.data ?? []) as Array<{ view_count: number | string; reply_count: number | string; listing_click_count: number | string }>).reduce((total, row) => ({ views: total.views + Number(row.view_count), replies: total.replies + Number(row.reply_count), listingClicks: total.listingClicks + Number(row.listing_click_count) }), { views: 0, replies: 0, listingClicks: 0 }) : null,
  }
}

export async function getOwnerStories(
  supabase: SupabaseClient,
  ownerId: string,
  viewerId?: string | null,
): Promise<StoryItem[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("id, user_id, media_path, media_type, caption, linked_listing_id, created_at, expires_at, duration_ms")
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(10)
  if (error) throw new Error(`owner_stories_failed:${error.message}`)
  const rows = (data ?? []) as StoryRow[]
  const listingIds = [...new Set(rows.map((row) => row.linked_listing_id).filter((id): id is string => Boolean(id)))]
  const storyIds = rows.map((row) => row.id)
  const [listingsResponse, seenResponse, likesResponse] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, slug, title, price, currency, cover_image_url, status").in("id", listingIds)
      : Promise.resolve({ data: [], error: null }),
    viewerId && storyIds.length
      ? supabase.from("story_views").select("story_id").eq("viewer_id", viewerId).in("story_id", storyIds)
      : Promise.resolve({ data: [], error: null }),
    viewerId && storyIds.length
      ? supabase.rpc("get_story_like_summary", { p_story_ids: storyIds })
      : Promise.resolve({ data: [], error: null }),
  ])
  if (likesResponse.error) throw new Error("story_likes_failed")
  const likes = new Map(((likesResponse.data ?? []) as Array<{ story_id: string; liked: boolean; like_count: number | string | null }>).map((item) => [item.story_id, item]))
  const listings = new Map((listingsResponse.data ?? []).map((listing) => [listing.id, listing]))
  const seen = new Set((seenResponse.data ?? []).map((view) => view.story_id))
  return rows.map((row) => {
    const listing = row.linked_listing_id ? listings.get(row.linked_listing_id) : null
    return {
      id: row.id,
      ownerId: row.user_id,
      mediaPath: row.media_path,
      mediaUrl: `/api/stories/media/${row.id}`,
      mediaType: row.media_type,
      caption: row.caption,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      durationMs: row.duration_ms,
      linkedListing: listing ? {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        price: Number(listing.price),
        currency: listing.currency,
        coverImageUrl: listing.cover_image_url,
        status: listing.status,
      } : null,
      viewed: seen.has(row.id),
      liked: likes.get(row.id)?.liked ?? false,
      likeCount: viewerId === row.user_id ? Number(likes.get(row.id)?.like_count ?? 0) : null,
    }
  })
}

export async function getFollowSummary(supabase: SupabaseClient, profileId: string, viewerId?: string | null) {
  const [followers, following, viewer] = await Promise.all([
    supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profileId),
    supabase.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", profileId),
    viewerId && viewerId !== profileId
      ? supabase.from("user_follows").select("following_id").eq("follower_id", viewerId).eq("following_id", profileId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  return { followers: followers.count ?? 0, following: following.count ?? 0, isFollowing: Boolean(viewer.data) }
}

export async function hasActiveStory(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase.from("stories").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null).gt("expires_at", new Date().toISOString())
  return (count ?? 0) > 0
}
