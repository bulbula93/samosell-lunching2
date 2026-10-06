import { POPULAR_BRANDS } from "@/lib/popular-brands"

export type MarketplaceSearchSuggestion = {
  kind: "brand" | "category"
  label: string
  href: string
  keywords: string[]
}

const SEARCH_CATEGORIES: MarketplaceSearchSuggestion[] = [
  { kind: "category", label: "ქალებისთვის", href: "/catalog/women", keywords: ["ქალი", "ქალის", "women"] },
  { kind: "category", label: "მამაკაცებისთვის", href: "/catalog/men", keywords: ["კაცი", "კაცის", "men", "მამაკაცი"] },
  { kind: "category", label: "ბავშვებისთვის", href: "/catalog/kids", keywords: ["ბავშვი", "საბავშვო", "kids"] },
  { kind: "category", label: "ფეხსაცმელი", href: "/catalog/footwear", keywords: ["ფეხსაცმელი", "shoe", "shoes", "sneakers", "კედი", "ბოტასი"] },
  { kind: "category", label: "ჩანთები", href: "/catalog/bags", keywords: ["ჩანთა", "bag", "bags", "backpack"] },
  { kind: "category", label: "ვინტაჟი", href: "/catalog/vintage", keywords: ["ვინტაჟი", "vintage"] },
  { kind: "category", label: "აქსესუარები", href: "/catalog/accessories", keywords: ["აქსესუარი", "accessories", "სამკაული", "ქამარი", "სათვალე"] },
  { kind: "category", label: "პარფიუმერია", href: "/catalog/perfume", keywords: ["პარფიუმერია", "სუნამო", "perfume", "parfum"] },
]

const BRAND_SUGGESTIONS: MarketplaceSearchSuggestion[] = POPULAR_BRANDS.map((brand) => ({
  kind: "brand",
  label: brand.name,
  href: `/catalog?brand=${encodeURIComponent(brand.name)}`,
  keywords: [brand.name],
}))

export const DEFAULT_POPULAR_SEARCH_SUGGESTIONS = [
  ...BRAND_SUGGESTIONS.slice(0, 6),
  ...SEARCH_CATEGORIES.slice(0, 6),
]

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9ა-ჰ]+/g, "")
}

function levenshtein(left: string, right: string) {
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length

  const row = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0]
    row[0] = i

    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j]
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + cost,
      )
      previous = current
    }
  }

  return row[right.length]
}

function suggestionScore(suggestion: MarketplaceSearchSuggestion, rawQuery: string) {
  const query = normalize(rawQuery)
  if (!query) return 0

  const candidates = [suggestion.label, ...suggestion.keywords].map(normalize).filter(Boolean)
  let best = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    if (candidate === query) return 0
    if (candidate.startsWith(query)) best = Math.min(best, 1)
    else if (candidate.includes(query)) best = Math.min(best, 2)

    if (query.length >= 3 && candidate.length >= 3) {
      const distance = levenshtein(query, candidate)
      const tolerance = query.length <= 5 ? 1 : 2
      if (distance <= tolerance) best = Math.min(best, 3 + distance)
    }
  }

  return best
}

export function getMarketplaceSearchSuggestions(query: string, limit = 8) {
  const all = [...BRAND_SUGGESTIONS, ...SEARCH_CATEGORIES]
  if (!query.trim()) return DEFAULT_POPULAR_SEARCH_SUGGESTIONS.slice(0, limit)

  return all
    .map((item, index) => ({ item, index, score: suggestionScore(item, query) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item)
}
