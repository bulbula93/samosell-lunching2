import {
  getCatalogItemKeywords,
  TOP_LEVEL_CATEGORY_SLUGS,
} from "@/lib/catalog-taxonomy"
import {
  summarizeFilters,
  type CatalogFilters,
} from "@/lib/catalog-page"

const SAVED_SEARCH_FILTER_KEYS: Array<keyof CatalogFilters> = [
  "q",
  "category",
  "item_type",
  "brand",
  "size",
  "color",
  "city",
  "condition",
  "gender",
  "vip",
  "min_price",
  "max_price",
]

export function hasSavableCatalogFilters(filters: CatalogFilters) {
  return SAVED_SEARCH_FILTER_KEYS.some((key) => Boolean(filters[key]))
}

export function buildSavedSearchPath(filters: CatalogFilters) {
  const params = new URLSearchParams()
  for (const key of SAVED_SEARCH_FILTER_KEYS) {
    const value = filters[key]
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/catalog?${query}` : "/catalog"
}

export function buildSavedSearchLabel(filters: CatalogFilters) {
  const summary = summarizeFilters(filters)
  return summary.join(" • ").slice(0, 180)
}

export function buildSavedSearchTerms(filters: CatalogFilters) {
  const terms = new Set<string>()
  if (filters.q) terms.add(filters.q)

  const category = filters.category
  if (
    category === "footwear" ||
    category === "bags" ||
    (category && !TOP_LEVEL_CATEGORY_SLUGS.has(category) && category !== "vintage")
  ) {
    for (const keyword of getCatalogItemKeywords(category)) terms.add(keyword)
  }

  if (filters.item_type) {
    for (const keyword of getCatalogItemKeywords(filters.item_type)) terms.add(keyword)
  }

  return Array.from(terms)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 50)
}

export function parseSavedSearchPrice(value: string) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
