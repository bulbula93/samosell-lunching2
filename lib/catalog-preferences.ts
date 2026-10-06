import { buildCatalogUrl, categoryFromCatalogPath } from "@/lib/catalog-urls"
import { readPreference, writePreference } from "@/lib/browser-preferences"
export const CATALOG_PREFERENCE_KEY = "samosell:catalog-filters:v1"
const ALLOWED = ["category", "item_type", "brand", "size", "color", "city", "condition", "gender", "vip", "sort", "min_price", "max_price"]
export function catalogPreferencePath(values: Record<string, string>) {
  const search = new URLSearchParams()
  for (const key of ALLOWED) {
    const value = values[key]
    if (value && value.length <= 150 && !(key === "sort" && ["latest", "relevance"].includes(value))) search.set(key, value)
  }
  return search.size ? buildCatalogUrl(search) : ""
}
export function rememberCatalogFilters(values: Record<string, string>) {
  const path = catalogPreferencePath(values)
  if (path) writePreference(CATALOG_PREFERENCE_KEY, path)
}
export function readCatalogFilters() {
  const value = readPreference<unknown>(CATALOG_PREFERENCE_KEY)
  if (typeof value !== "string" || !value.startsWith("/catalog") || value.length > 2000) return ""
  const parsed = new URL(value, "https://samosell.ge")
  if (parsed.origin !== "https://samosell.ge") return ""
  const category = categoryFromCatalogPath(parsed.pathname)
  if (parsed.pathname !== "/catalog" && !category) return ""
  const values = Object.fromEntries(parsed.searchParams)
  if (category) values.category = category
  return catalogPreferencePath(values)
}
