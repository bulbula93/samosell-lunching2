import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"
import { createClient } from "@/lib/supabase/server"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const now = new Date()
  const routes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/catalog`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/safety`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/sell-fast`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]
  try {
    const supabase = await createClient()
    const { data: listings } = await supabase
      .from("listings_catalog")
      .select("slug, published_at")
      .eq("status", "active")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200)

    const listingEntries: MetadataRoute.Sitemap = (listings ?? [])
      .filter((item) => item.slug)
      .map((item) => ({
        url: `${siteUrl}/listing/${item.slug}`,
        lastModified: item.published_at ? new Date(item.published_at) : now,
        changeFrequency: "daily",
        priority: 0.8,
      }))

    return [...routes, ...listingEntries]
  } catch {
    return routes
  }
}
