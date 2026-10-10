import type { MetadataRoute } from "next"
import { unstable_cache } from "next/cache"
import { catalogCategoryHref, INDEXABLE_CATALOG_CATEGORIES } from "@/lib/catalog-urls"
import { getSiteUrl } from "@/lib/seo"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { withQueryTimeout } from "@/lib/supabase/query-timeout"
import lastKnownGood from "@/lib/seo-sitemap-snapshot.json"

// Never freeze the sitemap at build time. Cache only the validated DB inventory;
// Next keeps the previous cached value if its background refresh throws.
export const dynamic = "force-dynamic"

type ListingEntry = { slug: string | null; updated_at: string | null }
type SellerEntry = { seller_username: string | null; published_at: string | null }
type SitemapInventory = { listings: ListingEntry[]; sellers: SellerEntry[] }

const getCachedInventory = unstable_cache(
  async (): Promise<SitemapInventory> => {
    const supabase = createPublicServerClient()
    const [listingsResult, sellersResult] = await Promise.all([
      withQueryTimeout(
        supabase.from("listings")
          .select("slug, updated_at")
          .eq("status", "active")
          .order("updated_at", { ascending: false, nullsFirst: false })
          .limit(1000),
      ),
      withQueryTimeout(
        supabase.from("listings_catalog")
          .select("seller_username, published_at")
          .eq("status", "active")
          .limit(1000),
      ),
    ])

    // A partial/failed result must not replace the last good inventory in the cache.
    if (listingsResult.error || sellersResult.error ||
        !Array.isArray(listingsResult.data) || !Array.isArray(sellersResult.data)) {
      throw new Error("seo_sitemap_inventory_unavailable")
    }

    return {
      listings: listingsResult.data,
      sellers: sellersResult.data,
    }
  },
  ["seo-sitemap-inventory-v1"],
  { revalidate: 900, tags: ["seo-sitemap-inventory"] },
)

function validDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : undefined
}

function inventoryEntries(siteUrl: string, inventory: SitemapInventory): MetadataRoute.Sitemap {
  const listingEntries: MetadataRoute.Sitemap = inventory.listings
    .filter((row): row is ListingEntry & { slug: string } => Boolean(row.slug))
    .map((row) => ({
      url: `${siteUrl}/listing/${encodeURIComponent(row.slug)}`,
      ...(validDate(row.updated_at) ? { lastModified: validDate(row.updated_at) } : {}),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }))

  const latestBySeller = new Map<string, string | null>()
  for (const row of inventory.sellers) {
    const username = row.seller_username?.trim()
    if (!username) continue
    const previous = latestBySeller.get(username)
    if (!previous || (row.published_at && row.published_at > previous)) {
      latestBySeller.set(username, row.published_at)
    }
  }

  const sellers: MetadataRoute.Sitemap = Array.from(latestBySeller, ([username, publishedAt]) => ({
    url: `${siteUrl}/seller/${encodeURIComponent(username)}`,
    ...(validDate(publishedAt) ? { lastModified: validDate(publishedAt) } : {}),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))

  return [...listingEntries, ...sellers]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const routes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalog`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/safety`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/sell-fast`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/vintage-georgia`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/sustainable-fashion`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/payment-terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/refund-policy`, changeFrequency: "yearly", priority: 0.3 },
    // These canonical pages exist independently of the count-query health.
    ...INDEXABLE_CATALOG_CATEGORIES.map((category) => ({
      url: `${siteUrl}${catalogCategoryHref(category.value)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ]

  let inventory: SitemapInventory
  try {
    inventory = await getCachedInventory()
  } catch (error) {
    console.warn("seo_sitemap_using_last_known_good", error instanceof Error ? error.message : "unknown")
    // The snapshot is public active listing/seller URLs captured on 2026-10-10.
    // Refresh it after major listing removals; do not treat a transient DB outage
    // as proof that active URLs should be deleted from the sitemap.
    inventory = lastKnownGood
  }

  const seen = new Set<string>()
  return [...routes, ...inventoryEntries(siteUrl, inventory)].filter((entry) => {
    if (seen.has(entry.url)) return false
    seen.add(entry.url)
    return true
  })
}
