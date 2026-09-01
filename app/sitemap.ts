import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const routes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalog`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/safety`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/sell-fast`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ]
  try {
    const supabase = await createClient()
    const { data: listings } = await supabase
      .from("listings_catalog")
      .select("slug, published_at, seller_username")
      .eq("status", "active")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1_000)

    const listingEntries: MetadataRoute.Sitemap = (listings ?? [])
      .filter((item) => item.slug)
      .map((item) => ({
        url: `${siteUrl}/listing/${item.slug}`,
        ...(item.published_at ? { lastModified: new Date(item.published_at) } : {}),
        changeFrequency: "daily",
        priority: 0.8,
      }))

    const sellerEntries: MetadataRoute.Sitemap = Array.from(
      new Set(
        (listings ?? [])
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
