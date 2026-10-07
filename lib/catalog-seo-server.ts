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
}, ["catalog-seo-pagination-count-v1"], { revalidate: 300, tags: ["catalog-seo-pagination-count"] })

export async function buildServerCatalogMetadata(params: CatalogPageParams = {}) {
  const { filters, page } = resolveCatalogState(params)
  if (page > 1 && resolveCatalogSeo(params).indexable) {
    try {
      const count = await getCategoryCount(filters.category)
      if ((page - 1) * PAGE_SIZE >= count) {
        return buildCatalogMetadata({ ...params, pagination_empty: "1" })
      }
    } catch {
      // Avoid indexing an unverified pagination URL during an upstream outage.
      return buildCatalogMetadata({ ...params, pagination_unverified: "1" })
    }
  }
  return buildCatalogMetadata(params)
}
