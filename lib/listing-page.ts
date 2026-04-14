import type { Metadata } from "next"
import { conditionLabel, formatPrice } from "@/lib/listings"
import { absoluteUrl, truncateDescription } from "@/lib/seo"
import { SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

export const listingSelect =
  "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, published_at, favorites_count, views_count, status"

export type ListingPageQueryParams = {
  chatError?: string | string[]
  report?: string | string[]
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

export function reportMessageLabel(value?: string) {
  switch (value) {
    case "ok":
      return "რეპორტი მიღებულია. მადლობა უკუკავშირისთვის."
    case "own":
      return "საკუთარ განცხადებას ვერ დაარეპორტებ."
    default:
      return value || ""
  }
}

export function formatJoinDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "long",
  }).format(new Date(value))
}

export function buildReasons(listing: CatalogListing, sellerVerified: boolean, sellerActiveListingsCount: number) {
  const reasons: string[] = []
  reasons.push(`${conditionLabel(listing.condition)} მდგომარეობა`)
  if (listing.brand_name) reasons.push(`ბრენდი: ${listing.brand_name}`)
  if (listing.size_label) reasons.push(`ზომა: ${listing.size_label}`)
  if (sellerVerified) reasons.push("დადასტურებული გამყიდველი")
  else if (sellerActiveListingsCount > 1) reasons.push(`${sellerActiveListingsCount} აქტიური განცხადება გამყიდველთან`)
  if (listing.city) reasons.push(`ქალაქი: ${listing.city}`)
  return reasons.slice(0, 4)
}

export async function fetchActiveListing(slug: string) {
  const supabase = await createClient()
  const { data: listing } = await supabase.from("listings_catalog").select(listingSelect).eq("slug", slug).maybeSingle()
  if (!listing || listing.status !== "active") return null
  return listing as CatalogListing
}

export async function generateListingMetadata(slug: string): Promise<Metadata> {
  const listing = await fetchActiveListing(slug)
  if (!listing) return { title: "განცხადება ვერ მოიძებნა", robots: { index: false, follow: false } }
  const title = `${listing.title} — ${formatPrice(listing.price, listing.currency)}`
  const description = truncateDescription(listing.description || `${listing.category_name} · ${listing.brand_name || SITE_NAME}`, 155)
  const socialDescription = truncateDescription(listing.description || SITE_DESCRIPTION_EN, 155)
  const path = `/listing/${listing.slug}`
  const imageUrl = listing.cover_image_url || absoluteUrl("/listing-og-fallback.png")

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description: socialDescription,
      url: absoluteUrl(path),
      type: "article",
      images: [{ url: imageUrl, alt: listing.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: socialDescription,
      images: [imageUrl],
    },
  }
}
