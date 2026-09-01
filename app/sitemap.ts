import type { MetadataRoute } from "next"
import { getSiteUrl, INDEXABLE_CATALOG_CATEGORIES } from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const routes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalog`, changeFrequency: "hourly", priority: 0.9 },
    ...INDEXABLE_CATALOG_CATEGORIES.map((category) => ({
      url: `${siteUrl}/catalog?category=${category.value}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/safety`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/sell-fast`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ]
  try {
    const supabase = await createClient()
    const [listingsResponse, sellersResponse] = await Promise.all([
      supabase
        .from("listings")
        .select("slug, updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1_000),
      supabase
        .from("listings_catalog")
        .select("seller_username")
        .eq("status", "active")
        .limit(1_000),
    ])
    if (listingsResponse.error || sellersResponse.error) {
      throw listingsResponse.error ?? sellersResponse.error
    }
    const listings = listingsResponse.data ?? []
    const sellers = sellersResponse.data ?? []

    const listingEntries: MetadataRoute.Sitemap = (listings ?? [])
      .filter((item) => item.slug)
      .map((item) => ({
        url: `${siteUrl}/listing/${item.slug}`,
        ...(item.updated_at ? { lastModified: new Date(item.updated_at) } : {}),
        changeFrequency: "daily",
        priority: 0.8,
      }))

    const sellerEntries: MetadataRoute.Sitemap = Array.from(
      new Set(
        sellers
          .map((item) => item.seller_username?.trim())
          .filter((username): username is string => Boolean(username)),
      ),
    ).map((username) => ({
      url: `${siteUrl}/seller/${encodeURIComponent(username)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }))

    return [...routes, ...sellerEntries, ...listingEntries]
  } catch {
    return routes
  }
}
