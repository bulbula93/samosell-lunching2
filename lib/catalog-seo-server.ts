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

// Production diagnostics are opt-in, deliberately limited to non-sensitive classifications.
// Never log query values, search terms, UTM values, cookies, or user identifiers.
function reportSeoMetadata(params: CatalogPageParams, result: ReturnType<typeof buildCatalogMetadata>, reason: string) {
  if (process.env.VERCEL_ENV !== "production" || process.env.SEO_METADATA_DIAGNOSTICS_ENABLED !== "true") return
  const seo = resolveCatalogSeo(params)
  const keys = Object.keys(params)
  console.info("[catalog-seo-diagnostic]", {
    route: seo.canonicalPath.split("?")[0],
    cleanRequest: keys.length === 0 || (keys.length === 1 && keys[0] === "category"),
    parameterCount: keys.length,
    pageIsArray: Array.isArray(params.page),
    categoryIsArray: Array.isArray(params.category),
    resolvedIndexable: seo.indexable,
    metadataIndex: typeof result.robots === "object" && !Array.isArray(result.robots) ? result.robots.index : null,
    reason,
  })
}

export async function buildServerCatalogMetadata(params: CatalogPageParams = {}) {
  const { filters, page } = resolveCatalogState(params)
  if (page > 1 && resolveCatalogSeo(params).indexable) {
    try {
      const count = await getCategoryCount(filters.category)
      if ((page - 1) * PAGE_SIZE >= count) {
        const metadata = buildCatalogMetadata({ ...params, pagination_empty: "1" })
        reportSeoMetadata(params, metadata, "pagination_empty")
        return metadata
      }
    } catch {
      // Avoid indexing an unverified pagination URL during an upstream outage.
      const metadata = buildCatalogMetadata({ ...params, pagination_unverified: "1" })
      reportSeoMetadata(params, metadata, "pagination_unverified")
      return metadata
    }
  }
  const metadata = buildCatalogMetadata(params)
  reportSeoMetadata(params, metadata, "normal")
  return metadata
}
