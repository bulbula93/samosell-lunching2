import type { Metadata } from "next"
import { resolveCatalogState, summarizeFilters, type CatalogSearchParams } from "@/lib/catalog-page"
import { absoluteUrl, buildCatalogCanonicalPath, buildCatalogDescription, buildCatalogTitle, getCategorySeo } from "@/lib/seo"

export type CatalogPageParams = CatalogSearchParams & {
  saved_search_status?: string | string[]
  [key: string]: string | string[] | undefined
}

export function resolveCatalogSeo(params: CatalogPageParams = {}) {
  const { filters, page } = resolveCatalogState(params)
  const legacyCategory = !filters.category && ["women", "men", "kids"].includes(filters.gender)
    ? filters.gender : ""
  const category = filters.category || legacyCategory
  const categoryKey = legacyCategory ? "gender" : "category"
  // Unknown, empty and repeated parameters are also non-canonical variants.
  const hasOtherFilters = Object.keys(params).some((key) => key !== categoryKey && key !== "page")
  const rawPage = typeof params.page === "string" ? params.page : ""
  const hasInvalidPage = params.page !== undefined && (page <= 1 || rawPage !== String(page))
  const seo = buildCatalogCanonicalPath({
    page, category, hasOtherFilters,
    hasSortParameter: params.sort !== undefined,
    hasTransientState: Boolean(legacyCategory) || hasInvalidPage || Array.isArray(params[categoryKey]),
  })
  const categorySeo = getCategorySeo(category)
  const title = categorySeo
    ? `${categorySeo.title}${page > 1 ? ` — გვერდი ${page}` : ""}`
    : buildCatalogTitle(page, seo.categoryLabel)
  const description = categorySeo?.description ?? buildCatalogDescription(summarizeFilters(filters))
  return { ...seo, title, description, categorySeo }
}

export function buildCatalogMetadata(params: CatalogPageParams = {}): Metadata {
  const seo = resolveCatalogSeo(params)
  const url = absoluteUrl(seo.canonicalPath)
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: url },
    robots: { index: seo.indexable, follow: true },
    openGraph: { title: seo.title, description: seo.description, url, type: "website", images: [{ url: absoluteUrl("/opengraph-image") }] },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images: [absoluteUrl("/opengraph-image")] },
  }
}
