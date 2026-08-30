import {
  getCatalogItemKeywords,
  getCatalogItemLabel,
  getCatalogSectionLabel,
  TOP_LEVEL_CATEGORY_SLUGS,
} from "@/lib/catalog-taxonomy"

export type CatalogSearchParams = {
  q?: string | string[]
  category?: string | string[]
  item_type?: string | string[]
  brand?: string | string[]
  size?: string | string[]
  color?: string | string[]
  city?: string | string[]
  condition?: string | string[]
  new_only?: string | string[]
  gender?: string | string[]
  vip?: string | string[]
  sort?: string | string[]
  min_price?: string | string[]
  max_price?: string | string[]
  page?: string | string[]
}

export type CatalogFilters = {
  q: string
  category: string
  item_type: string
  brand: string
  size: string
  color: string
  city: string
  condition: string
  gender: string
  vip: string
  min_price: string
  max_price: string
}

export const PAGE_SIZE = 24

const readParam = (value?: string | string[]) => (typeof value === "string" ? value : "")
export const safeQueryValue = (value: string) => value.replace(/,/g, " ").trim()
export const normalizeText = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ")

export function parsePage(value: string) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("ka-GE").format(value)
}

type CatalogFilterable = {
  or: (filters: string) => unknown
  eq: (column: string, value: string | boolean) => unknown
  gte: (column: string, value: number) => unknown
  lte: (column: string, value: number) => unknown
}

function addItemKeywords(searchTerms: Set<string>, value?: string) {
  if (!value) return
  for (const keyword of getCatalogItemKeywords(value)) searchTerms.add(keyword)
}

export function applyCatalogFilters<T>(query: T, filters: Record<string, string>) {
  let next = query as T & CatalogFilterable

  const searchTerms = new Set<string>()
  if (filters.q) searchTerms.add(filters.q)

  const category = filters.category
  if (category) {
    if (category === "women" || category === "men" || category === "kids") {
      next = next.eq("gender", category) as T & CatalogFilterable
    } else if (category === "accessories" || category === "vintage") {
      next = next.eq("category_slug", category) as T & CatalogFilterable
    } else if (category === "footwear" || category === "bags") {
      addItemKeywords(searchTerms, category)
    } else if (!TOP_LEVEL_CATEGORY_SLUGS.has(category)) {
      // Backward compatibility for old links where the item type lived in `category`.
      addItemKeywords(searchTerms, category)
    }
  }

  addItemKeywords(searchTerms, filters.item_type)

  if (searchTerms.size > 0) {
    const clauses = Array.from(searchTerms).flatMap((term) => [
      `title.ilike.%${term}%`,
      `description.ilike.%${term}%`,
      `category_name.ilike.%${term}%`,
      `brand_name.ilike.%${term}%`,
    ])
    next = next.or(Array.from(new Set(clauses)).join(",")) as T & CatalogFilterable
  }

  // Keep legacy brand URLs working, but the current catalog UI no longer exposes a brand dropdown.
  if (filters.brand) next = next.eq("brand_name", filters.brand) as T & CatalogFilterable
  if (filters.size) next = next.eq("size_label", filters.size) as T & CatalogFilterable
  if (filters.color) next = next.eq("color", filters.color) as T & CatalogFilterable
  if (filters.city) next = next.eq("city", filters.city) as T & CatalogFilterable
  if (filters.condition) next = next.eq("condition", filters.condition) as T & CatalogFilterable
  if (filters.gender && category !== "women" && category !== "men" && category !== "kids") {
    next = next.eq("gender", filters.gender) as T & CatalogFilterable
  }
  if (filters.vip === "1") next = next.eq("is_vip", true) as T & CatalogFilterable
  if (filters.min_price) {
    const minPrice = Number.parseInt(filters.min_price, 10)
    if (Number.isFinite(minPrice)) next = next.gte("price", minPrice) as T & CatalogFilterable
  }
  if (filters.max_price) {
    const maxPrice = Number.parseInt(filters.max_price, 10)
    if (Number.isFinite(maxPrice)) next = next.lte("price", maxPrice) as T & CatalogFilterable
  }

  return next as T
}

export function getCatalogPath(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params)
  if (page <= 1) next.delete("page")
  else next.set("page", String(page))
  const query = next.toString()
  return query ? `/catalog?${query}` : "/catalog"
}

export function summarizeFilters(filters: Record<string, string>) {
  const active = [] as string[]
  const conditionLabels: Record<string, string> = { new: "ახალი", like_new: "თითქმის ახალი", good: "კარგი", fair: "საშუალო" }
  const genderLabels: Record<string, string> = { women: "ქალები", men: "კაცები", unisex: "უნისექსი", kids: "ბავშვები" }
  if (filters.q) active.push(`ძებნა: ${filters.q}`)
  if (filters.category) active.push(`კატეგორია: ${getCatalogSectionLabel(filters.category)}`)
  if (filters.item_type) active.push(`ნივთის ტიპი: ${getCatalogItemLabel(filters.item_type)}`)
  if (filters.brand) active.push(`ბრენდი: ${filters.brand}`)
  if (filters.size) active.push(`ზომა: ${filters.size}`)
  if (filters.color) active.push(`ფერი: ${filters.color}`)
  if (filters.city) active.push(`ქალაქი: ${filters.city}`)
  if (filters.condition) active.push(`მდგომარეობა: ${conditionLabels[filters.condition] ?? filters.condition}`)
  if (filters.gender) active.push(`სექცია: ${genderLabels[filters.gender] ?? filters.gender}`)
  if (filters.vip === "1") active.push("მხოლოდ VIP")
  if (filters.min_price || filters.max_price) active.push(`ფასი: ${filters.min_price || "0"}-${filters.max_price || "∞"} ₾`)
  return active
}

export function resolveCatalogState(params: CatalogSearchParams = {}) {
  const filters: CatalogFilters = {
    q: safeQueryValue(readParam(params.q)),
    category: readParam(params.category),
    item_type: readParam(params.item_type),
    brand: readParam(params.brand),
    size: readParam(params.size),
    color: readParam(params.color),
    city: readParam(params.city),
    condition: readParam(params.condition) || (readParam(params.new_only) ? "new" : ""),
    gender: readParam(params.gender),
    vip: readParam(params.vip),
    min_price: readParam(params.min_price),
    max_price: readParam(params.max_price),
  }
  const sort = readParam(params.sort) || "latest"
  const page = parsePage(readParam(params.page))

  const queryParams = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) queryParams.set(key, value)
  })
  if (sort && sort !== "latest") queryParams.set("sort", sort)
  if (page > 1) queryParams.set("page", String(page))

  return {
    filters,
    sort,
    page,
    queryParams,
    currentPath: getCatalogPath(queryParams, page),
  }
}
