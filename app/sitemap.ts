import { catalogCategoryHref } from "@/lib/catalog-urls"
import type { MetadataRoute } from "next"
import { applyCatalogFilters } from "@/lib/catalog-page"
import { getSiteUrl, INDEXABLE_CATALOG_CATEGORIES } from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const routes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalog`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/safety`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/sell-fast`, changeFrequency: "monthly", priority: 0.6 },\n    { url: `${siteUrl}/vintage-georgia`, changeFrequency: "monthly", priority: 0.6 },\n    { url: `${siteUrl}/sustainable-fashion`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/payment-terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/refund-policy`, changeFrequency: "yearly", priority: 0.3 },
  ]

  try {
    const supabase = await createClient()
    const categoryCountPromises = INDEXABLE_CATALOG_CATEGORIES.map(async (category) => {
      const baseQuery = supabase
        .from("listings_catalog")
        .select("published_at", { count: "exact" })
        .eq("status", "active")
      const response = await applyCatalogFilters(baseQuery, {
        category: category.value,
      })
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(1)
      return {
        category,
        count: response.count ?? 0,
        latestPublishedAt: response.data?.[0]?.published_at ?? null,
        error: response.error,
      }
    })

    const [listingsResponse, sellersResponse, categoryCounts] = await Promise.all([
      supabase
        .from("listings")
        .select("slug, updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1_000),
      supabase
        .from("listings_catalog")
        .select("seller_username, published_at")
        .eq("status", "active")
        .limit(1_000),
      Promise.all(categoryCountPromises),
    ])

    if (listingsResponse.error || sellersResponse.error) {
      throw listingsResponse.error ?? sellersResponse.error
    }

    const listings = listingsResponse.data ?? []
    const sellers = sellersResponse.data ?? []

    const categoryEntries: MetadataRoute.Sitemap = categoryCounts
      .filter(({ count, error }) => !error && count > 0)
      .map(({ category, latestPublishedAt }) => ({
        url: `${siteUrl}${catalogCategoryHref(category.value)}`,
        ...(latestPublishedAt ? { lastModified: new Date(latestPublishedAt) } : {}),
        changeFrequency: "daily",
        priority: 0.7,
      }))

    const listingEntries: MetadataRoute.Sitemap = listings
      .filter((item) => item.slug)
      .map((item) => ({
        url: `${siteUrl}/listing/${item.slug}`,
        ...(item.updated_at ? { lastModified: new Date(item.updated_at) } : {}),
        changeFrequency: "daily",
        priority: 0.8,
      }))

    const sellerLatestPublishedAt = new Map<string, string>()
    for (const item of sellers) {
      const username = item.seller_username?.trim()
      if (!username || !item.published_at) continue
      const previous = sellerLatestPublishedAt.get(username)
      if (!previous || item.published_at > previous) {
        sellerLatestPublishedAt.set(username, item.published_at)
      }
    }

    const sellerEntries: MetadataRoute.Sitemap = Array.from(
      new Set(
        sellers
          .map((item) => item.seller_username?.trim())
          .filter((username): username is string => Boolean(username)),
      ),
    ).map((username) => ({
      url: `${siteUrl}/seller/${encodeURIComponent(username)}`,
      ...(sellerLatestPublishedAt.get(username)
        ? { lastModified: new Date(sellerLatestPublishedAt.get(username)!) }
        : {}),
      changeFrequency: "weekly",
      priority: 0.6,
    }))

    return [...routes, ...categoryEntries, ...sellerEntries, ...listingEntries]
  } catch {
    return routes
  }
}
