import type { Metadata } from "next"
import { notFound } from "next/navigation"
import SiteHeader from "@/components/layout/SiteHeader"
import ListingGallery from "@/components/listings/ListingGallery"
import ListingOverviewCard from "@/components/listings/ListingOverviewCard"
import ProductPageSectionsNav from "@/components/listings/ProductPageSectionsNav"
import SimilarListingsSection from "@/components/listings/SimilarListingsSection"
import RecentlyViewedTracker from "@/components/listings/RecentlyViewedTracker"
import {
  generateListingMetadata,
  listingSelect,
  reportMessageLabel,
  type ListingPageQueryParams,
  type ListingSellerProfile,
} from "@/lib/listing-page"
import { getUserAvatar } from "@/lib/profiles"
import { rankSimilarListings } from "@/lib/similar-items"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return generateListingMetadata(slug)
}

export default async function ListingDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<ListingPageQueryParams>
}) {
  const { slug } = await params
  const query = (await searchParams) ?? {}
  const chatError = typeof query.chatError === "string" ? query.chatError : ""
  const reportFlash = typeof query.report === "string" ? reportMessageLabel(query.report) : ""

  const supabase = await createClient()
  const [authResponse, listingResponse] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("listings_catalog").select(listingSelect).eq("slug", slug).maybeSingle(),
  ])

  const user = authResponse.data.user
  const listing = listingResponse.data as CatalogListing | null
  if (!listing || listing.status !== "active") notFound()

  const sellerProfileQuery = listing.seller_id
    ? supabase
        .from("profiles")
        .select("id, username, full_name, bio, city, created_at, is_seller_verified, is_suspended, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url")
        .eq("id", listing.seller_id)
        .maybeSingle()
    : Promise.resolve({ data: null })

  const sellerActiveCountQuery = listing.seller_id
    ? supabase.from("listings").select("id", { count: "exact", head: true }).eq("seller_id", listing.seller_id).eq("status", "active")
    : Promise.resolve({ count: 1 })

  const sameCategoryQuery = listing.category_slug
    ? supabase
        .from("listings_catalog")
        .select(listingSelect)
        .eq("status", "active")
        .eq("category_slug", listing.category_slug)
        .neq("id", listing.id)
        .limit(24)
    : Promise.resolve({ data: [] as CatalogListing[] })

  const sameBrandQuery = listing.brand_name
    ? supabase
        .from("listings_catalog")
        .select(listingSelect)
        .eq("status", "active")
        .eq("brand_name", listing.brand_name)
        .neq("id", listing.id)
        .limit(16)
    : Promise.resolve({ data: [] as CatalogListing[] })

  const fallbackQuery = supabase
    .from("listings_catalog")
    .select(listingSelect)
    .eq("status", "active")
    .neq("id", listing.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(18)

  const [
    imagesResponse,
    sellerProfileResponse,
    sellerActiveCountResponse,
    sameCategoryResponse,
    sameBrandResponse,
    fallbackResponse,
    favoriteRowResponse,
    favoritesResponse,
    myBlockResponse,
    theirBlockResponse,
  ] = await Promise.all([
    supabase.from("listing_images").select("id, image_url, sort_order").eq("listing_id", listing.id).order("sort_order", { ascending: true }),
    sellerProfileQuery,
    sellerActiveCountQuery,
    sameCategoryQuery,
    sameBrandQuery,
    fallbackQuery,
    user ? supabase.from("favorites").select("id").eq("user_id", user.id).eq("listing_id", listing.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("favorites").select("listing_id").eq("user_id", user.id) : Promise.resolve({ data: [] as { listing_id: string }[] }),
    user && listing.seller_id
      ? supabase.from("user_blocks").select("id").eq("blocker_id", user.id).eq("blocked_id", listing.seller_id).maybeSingle()
      : Promise.resolve({ data: null }),
    user && listing.seller_id
      ? supabase.from("user_blocks").select("id").eq("blocker_id", listing.seller_id).eq("blocked_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const sellerProfileNeedsUsernameFallback = Boolean(
    listing.seller_username && (!sellerProfileResponse.data || (!sellerProfileResponse.data.avatar_url && !sellerProfileResponse.data.store_logo_url)),
  )

  const sellerProfileFallbackResponse = sellerProfileNeedsUsernameFallback
    ? await supabase
        .from("profiles")
        .select("id, username, full_name, bio, city, created_at, is_seller_verified, is_suspended, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url")
        .eq("username", listing.seller_username)
        .maybeSingle()
    : { data: null }

  try {
    await supabase.rpc("increment_listing_views", { p_listing_id: listing.id })
  } catch {
    // ignored until migration is applied
  }

  const sellerProfile: ListingSellerProfile | null = sellerProfileResponse.data
    ? {
        ...sellerProfileFallbackResponse.data,
        ...sellerProfileResponse.data,
        avatar_url: sellerProfileResponse.data.avatar_url || sellerProfileFallbackResponse.data?.avatar_url || null,
        store_logo_url: sellerProfileResponse.data.store_logo_url || sellerProfileFallbackResponse.data?.store_logo_url || null,
      }
    : sellerProfileFallbackResponse.data
  const sellerActiveListingsCount = sellerActiveCountResponse.count ?? 1
  const favoriteIds = (favoritesResponse.data ?? []).map((item) => item.listing_id)
  const similarCandidates = [
    ...((sameCategoryResponse.data ?? []) as CatalogListing[]),
    ...((sameBrandResponse.data ?? []) as CatalogListing[]),
    ...((fallbackResponse.data ?? []) as CatalogListing[]),
  ]
  const dedupedCandidates = Array.from(new Map(similarCandidates.map((item) => [item.id, item])).values())
  const similarItems = rankSimilarListings(listing, dedupedCandidates, 8)

  const isOwner = Boolean(user?.id && listing.seller_id === user.id)
  const sellerLabel = sellerProfile?.full_name || listing.seller_full_name || listing.seller_username || "უცნობი"
  const sellerType = sellerProfile?.seller_type || listing.seller_type || "individual"
  const sellerAvatarSrc =
    listing.seller_avatar_url ||
    (sellerType === "store" ? listing.seller_store_logo_url || null : null) ||
    getUserAvatar(sellerProfile)
  const isFavorited = Boolean(favoriteRowResponse.data)
  const isBlocked = Boolean(myBlockResponse.data)
  const isBlockedBySeller = Boolean(theirBlockResponse.data)
  const canChat = !isOwner && !isBlocked && !isBlockedBySeller && !sellerProfile?.is_suspended

  return (
    <main className="min-h-screen bg-white text-[#2D2D2D]">
      <SiteHeader />
      <ProductPageSectionsNav />
      <RecentlyViewedTracker listingId={listing.id} />

      <section className="mx-auto w-full max-w-[1440px] px-4 pb-0 pt-10 sm:px-6 lg:px-8 xl:px-[80px]">
        <div className="grid items-start gap-8 xl:grid-cols-[632px_minmax(0,616px)] xl:gap-8">
          <ListingGallery title={listing.title} coverImageUrl={listing.cover_image_url} images={imagesResponse.data ?? []} />

          <div className="space-y-4">
            <ListingOverviewCard
              listing={listing}
              sellerProfile={sellerProfile}
              sellerLabel={sellerLabel}
              sellerAvatarSrc={sellerAvatarSrc}
              sellerActiveListingsCount={sellerActiveListingsCount}
              isOwner={isOwner}
              isAuthenticated={Boolean(user)}
              canChat={canChat}
              isFavorited={isFavorited}
              chatError={chatError}
              reportFlash={reportFlash}
              isBlocked={isBlocked}
              isBlockedBySeller={isBlockedBySeller}
              sellerSuspended={Boolean(sellerProfile?.is_suspended)}
            />

          </div>
        </div>
      </section>

      <SimilarListingsSection listingSlug={listing.slug} similarItems={similarItems} favoriteIds={favoriteIds} />
    </main>
  )
}
