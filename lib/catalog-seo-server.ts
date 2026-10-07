import "server-only"
import { unstable_cache } from "next/cache"
import { applyCatalogFilters, resolveCatalogState } from "@/lib/catalog-page"
import { buildCatalogMetadata, resolveCatalogSeo, type CatalogPageParams } from "@/lib/catalog-seo"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { withQueryTimeout } from "@/lib/supabase/query-timeout"
import { PAGE_SIZE } from "@/lib/catalog-page"

const getCategoryCount = unstable_cache(async (category: string) => {
  const client = createPublicServerClient()
  const response = await withQueryTimeout(applyCatalogFilters(
    client.from("listings_catalog").select("id", { count: "exact", head: true }).eq("status", "active"),
    { category },
  ))
  if (response.error) throw new Error("catalog_seo_count_failed")
  return response.count ?? 0
}, ["catalog-seo-pagination-count-v2"], { revalidate: 300, tags: ["catalog-seo-pagination-count"] })

export async function buildServerCatalogMetadata(params: CatalogPageParams = {}) {
  const { filters, page } = resolveCatalogState(params)
  const resolvedSeo = resolveCatalogSeo(params)

  if (filters.category && resolvedSeo.categorySeo && resolvedSeo.indexable) {
    try {
      const count = await getCategoryCount(filters.category)

      // A category with confirmed zero inventory is useful for navigation but
      // should not compete in search as a thin landing page.
      if (page === 1 && count === 0) {
        return buildCatalogMetadata({ ...params, inventory_empty: "1" })
      }

      if (page > 1 && (page - 1) * PAGE_SIZE >= count) {
        return buildCatalogMetadata({ ...params, pagination_empty: "1" })
      }
    } catch {
      // Keep established category roots stable during an upstream outage, but
      // avoid indexing an unverified pagination URL.
      if (page > 1) {
        return buildCatalogMetadata({ ...params, pagination_unverified: "1" })
      }
    }
  }

  return buildCatalogMetadata(params)
}
