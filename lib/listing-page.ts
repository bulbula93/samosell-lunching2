import type { Metadata } from "next"
import { cache } from "react"
import { ka } from "@/lib/i18n/ka"
import { conditionLabel, formatPrice } from "@/lib/listings"
import { getSafeImageSource } from "@/lib/media"
import { absoluteUrl, truncateDescription } from "@/lib/seo"
import { SITE_DESCRIPTION_KA, SITE_NAME } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing, ListingImage } from "@/types/marketplace"

const LISTING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i
const OWNER_VISIBLE_STATUSES = new Set(["active", "reserved", "sold"])

export const listingSelect =
  "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, published_at, favorites_count, views_count, status"

export const publicSellerSelect =
  "id, username, full_name, bio, city, created_at, is_seller_verified, is_suspended, avatar_url, seller_type, store_logo_url"

export type ListingPageQueryParams = {
  chatError?: string | string[]
  favorite?: string | string[]
  report?: string | string[]
  safety?: string | string[]
}

export type ListingSellerProfile = {
  id?: string
  username?: string | null
  full_name?: string | null
  bio?: string | null
  city?: string | null
  created_at?: string | null
  is_seller_verified?: boolean | null
  is_suspended?: boolean | null
  avatar_url?: string | null
  seller_type?: string | null
  store_logo_url?: string | null
  store_banner_url?: string | null
  store_phone?: string | null
  store_whatsapp?: string | null
  store_telegram?: string | null
  store_instagram?: string | null
  store_facebook?: string | null
  store_website?: string | null
  store_hours?: string | null
  store_address?: string | null
  store_map_url?: string | null
}

export type ListingPageData = {
  listing: CatalogListing
  images: ListingImage[]
  sellerProfile: ListingSellerProfile | null
  sellerActiveListingsCount: number
  similarItems: CatalogListing[]
  favoriteIds: string[]
  isFavorited: boolean
  isAuthenticated: boolean
  isOwner: boolean
  canChat: boolean
  isBlocked: boolean
  isBlockedBySeller: boolean
}

export function isValidListingSlug(value: string) {
  return value.length > 0 && value.length <= 160 && LISTING_SLUG_PATTERN.test(value)
}

export function canRenderListingStatus(status: string | null | undefined, isOwner: boolean) {
  if (status === "active") return true
  return isOwner && OWNER_VISIBLE_STATUSES.has(String(status ?? ""))
}

export function listingDetailStatusLabel(status?: string | null) {
  if (status === "reserved") return ka.listingDetail.reserved
  if (status === "sold") return ka.listingDetail.sold
  return ka.listingDetail.available
}

export function reportMessageLabel(value?: string) {
  switch (value) {
    case "ok":
      return "რეპორტი მიღებულია. მადლობა უკუკავშირისთვის."
    case "user-ok":
      return "მომხმარებლის რეპორტი მიღებულია. მადლობა უკუკავშირისთვის."
    case "own":
      return "საკუთარ განცხადებას ვერ დაარეპორტებ."
    default:
      return value || ""
  }
}

export function safetyMessageLabel(value?: string) {
  switch (value) {
    case "blocked":
      return "მომხმარებელი დაბლოკილია. მასთან ახალი შეტყობინებების გაცვლა შეჩერდა."
    case "unblocked":
      return "მომხმარებელს ბლოკი მოეხსნა."
    default:
      return value || ""
  }
}

export function formatJoinDate(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "long",
  }).format(date)
}

export function buildReasons(
  listing: CatalogListing,
  sellerVerified: boolean,
  sellerActiveListingsCount: number,
) {
  const reasons: string[] = []
  reasons.push(`${conditionLabel(listing.condition)} მდგომარეობა`)
  if (listing.brand_name) reasons.push(`ბრენდი: ${listing.brand_name}`)
  if (listing.size_label) reasons.push(`ზომა: ${listing.size_label}`)
  if (sellerVerified) reasons.push("დადასტურებული გამყიდველი")
  else if (sellerActiveListingsCount > 1) {
    reasons.push(`${sellerActiveListingsCount} აქტიური განცხადება გამყიდველთან`)
  }
  if (listing.city) reasons.push(`ქალაქი: ${listing.city}`)
  return reasons.slice(0, 4)
}

function getMetadataImage(value?: string | null) {
  const safe = getSafeImageSource(value)
  if (!safe) return absoluteUrl("/listing-og-fallback.png")
  return safe.startsWith("/") ? absoluteUrl(safe) : safe
}

const fetchActiveListing = cache(async (slug: string) => {
  if (!isValidListingSlug(slug)) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("listings_catalog")
    .select(listingSelect)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle()

  if (error || !data) return null
  return data as CatalogListing
})

export async function generateListingMetadata(slug: string): Promise<Metadata> {
  const listing = await fetchActiveListing(slug)
  if (!listing) {
    return {
      title: ka.listingDetail.notFoundTitle,
      description: ka.listingDetail.notFoundDescription,
      robots: { index: false, follow: false },
    }
  }

  const title = `${listing.title} — ${formatPrice(listing.price, listing.currency)}`
  const description = truncateDescription(
    listing.description || [listing.category_name, listing.brand_name].filter(Boolean).join(" · "),
    155,
  ) || SITE_DESCRIPTION_KA
  const path = `/listing/${listing.slug}`
  const canonicalUrl = absoluteUrl(path)
  const imageUrl = getMetadataImage(listing.cover_image_url)

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: SITE_NAME,
      images: [{ url: imageUrl, alt: listing.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  }
}

export async function fetchListingPageData(slug: string): Promise<ListingPageData | null> {
  if (!isValidListingSlug(slug)) return null

  const supabase = await createClient()
  const [authResponse, listingResponse] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("listings_catalog").select(listingSelect).eq("slug", slug).maybeSingle(),
  ])

  if (listingResponse.error) {
    throw new Error("LISTING_QUERY_FAILED", { cause: listingResponse.error })
  }

  const user = authResponse.data.user
  const listing = listingResponse.data as CatalogListing | null
  if (!listing) return null

  const isOwner = Boolean(user?.id && listing.seller_id === user.id)
  if (!canRenderListingStatus(listing.status, isOwner)) return null

  const isActive = listing.status === "active"
  const sellerProfileQuery = listing.seller_id
    ? supabase
        .from("profiles")
        .select(publicSellerSelect)
        .eq("id", listing.seller_id)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null })

  const sellerActiveCountQuery = listing.seller_id
    ? supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", listing.seller_id)
        .eq("status", "active")
    : Promise.resolve({ count: 0, error: null })

  const similarItemsQuery = isActive && listing.category_slug
    ? supabase
        .from("listings_catalog")
        .select(listingSelect)
        .eq("status", "active")
        .eq("category_slug", listing.category_slug)
        .neq("id", listing.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(8)
    : Promise.resolve({ data: [] as CatalogListing[], error: null })

  const shouldLoadViewerData = Boolean(user && !isOwner && isActive)
  const [
    imagesResponse,
    sellerProfileResponse,
    sellerActiveCountResponse,
    similarItemsResponse,
    favoriteRowResponse,
    favoritesResponse,
    myBlockResponse,
    theirBlockResponse,
  ] = await Promise.all([
    supabase
      .from("listing_images")
      .select("id, image_url, sort_order")
      .eq("listing_id", listing.id)
      .order("sort_order", { ascending: true }),
    sellerProfileQuery,
    sellerActiveCountQuery,
    similarItemsQuery,
    shouldLoadViewerData
      ? supabase
          .from("favorites")
          .select("id")
          .eq("user_id", user!.id)
          .eq("listing_id", listing.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    user
      ? supabase.from("favorites").select("listing_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { listing_id: string }[], error: null }),
    shouldLoadViewerData && listing.seller_id
      ? supabase
          .from("user_blocks")
          .select("id")
          .eq("blocker_id", user!.id)
          .eq("blocked_id", listing.seller_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    shouldLoadViewerData && listing.seller_id
      ? supabase
          .from("user_blocks")
          .select("id")
          .eq("blocker_id", listing.seller_id)
          .eq("blocked_id", user!.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const criticalError =
    imagesResponse.error ||
    sellerProfileResponse.error ||
    sellerActiveCountResponse.error ||
    similarItemsResponse.error

  if (criticalError) {
    throw new Error("LISTING_RELATED_QUERY_FAILED", { cause: criticalError })
  }

  const sellerProfile = (sellerProfileResponse.data ?? null) as ListingSellerProfile | null
  const isBlocked = Boolean(myBlockResponse.data)
  const isBlockedBySeller = Boolean(theirBlockResponse.data)
  const canChat =
    shouldLoadViewerData &&
    !isBlocked &&
    !isBlockedBySeller &&
    !sellerProfile?.is_suspended

  return {
    listing,
    images: (imagesResponse.data ?? []) as ListingImage[],
    sellerProfile,
    sellerActiveListingsCount: sellerActiveCountResponse.count ?? 0,
    similarItems: (similarItemsResponse.data ?? []) as CatalogListing[],
    favoriteIds: (favoritesResponse.data ?? []).map((item) => item.listing_id),
    isFavorited: Boolean(favoriteRowResponse.data),
    isAuthenticated: Boolean(user),
    isOwner,
    canChat,
    isBlocked,
    isBlockedBySeller,
  }
}
