// Shared by server routes and client navigation. Keep this whitelist independent
// of database taxonomy: legacy item types still work as query filters.
export const INDEXABLE_CATALOG_CATEGORIES = [
  { value: "women", label: "ქალებისთვის" },
  { value: "men", label: "მამაკაცებისთვის" },
  { value: "kids", label: "ბავშვებისთვის" },
  { value: "footwear", label: "ფეხსაცმელი" },
  { value: "bags", label: "ჩანთები" },
  { value: "vintage", label: "ვინტაჟი" },
  { value: "accessories", label: "აქსესუარები" },
  { value: "perfume", label: "პარფიუმერია" },
] as const

export type CatalogCategory = (typeof INDEXABLE_CATALOG_CATEGORIES)[number]["value"]

export function isCatalogCategory(value: unknown): value is CatalogCategory {
  return INDEXABLE_CATALOG_CATEGORIES.some((item) => item.value === value)
}

export function categoryFromCatalogPath(pathname: string): CatalogCategory | null {
  const value = pathname.match(/^\/catalog\/([^/]+)$/)?.[1]
  return isCatalogCategory(value) ? value : null
}

export function buildCatalogUrl(params: URLSearchParams = new URLSearchParams()) {
  const next = new URLSearchParams(params)
  const categories = next.getAll("category")
  const category = categories.length === 1 ? categories[0] : null
  const path = isCatalogCategory(category) ? `/catalog/${category}` : "/catalog"
  if (isCatalogCategory(category)) next.delete("category")
  return next.size ? `${path}?${next}` : path
}

export function catalogCategoryHref(category?: string | null) {
  const params = new URLSearchParams()
  if (category) params.set("category", category)
  return buildCatalogUrl(params)
}

// Preserve every non-category parameter, including duplicate values, tracking
// parameters and saved-search state. Returns null once a URL is normalized.
export function getCatalogRedirectPath(pathname: string, params: URLSearchParams) {
  if (pathname !== "/catalog" && !categoryFromCatalogPath(pathname)) return null
  const categories = params.getAll("category")
  if (categories.length !== 1) return null
  if (pathname === "/catalog" && !isCatalogCategory(categories[0])) return null
  const next = new URLSearchParams(params)
  if (!categories[0]) next.delete("category")
  const destination = buildCatalogUrl(next)
  const current = params.size ? `${pathname}?${params}` : pathname
  return destination === current ? null : destination
}
