import type { CatalogListing } from "@/types/marketplace"

const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "closet",
  "market",
  "item",
  "vintage",
  "new",
  "black",
  "white",
])

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function tokenize(value?: string | null) {
  return normalizeText(value)
    .split(/[^a-z0-9ა-ჰ]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !STOP_WORDS.has(item))
}

function overlapScore(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0
  const rightSet = new Set(right)
  let score = 0
  left.forEach((token) => {
    if (rightSet.has(token)) score += 2
  })
  return score
}

function recencyBonus(value?: string | null) {
  if (!value) return 0
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  const diffDays = Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 3) return 2
  if (diffDays <= 14) return 1
  return 0
}

export function scoreSimilarListing(base: CatalogListing, candidate: CatalogListing) {
  if (base.id === candidate.id) return Number.NEGATIVE_INFINITY
  if (base.seller_id && candidate.seller_id && base.seller_id === candidate.seller_id) return -1

  let score = 0
  if (candidate.category_slug && base.category_slug && candidate.category_slug === base.category_slug) score += 12
  if (candidate.brand_name && base.brand_name && candidate.brand_name === base.brand_name) score += 7
  if (candidate.size_label && base.size_label && candidate.size_label === base.size_label) score += 5
  if (candidate.gender && base.gender && candidate.gender === base.gender) score += 4
  if (candidate.condition && base.condition && candidate.condition === base.condition) score += 3
  if (candidate.city && base.city && candidate.city === base.city) score += 2
  if (candidate.material && base.material && candidate.material === base.material) score += 2
  if (candidate.color && base.color && candidate.color === base.color) score += 1
  if (candidate.is_featured) score += 1.5
  if (candidate.is_promoted) score += 1
  if (candidate.is_vip) score += 0.5
  score += overlapScore(tokenize(base.title), tokenize(candidate.title))
  score += overlapScore(tokenize(base.description), tokenize(candidate.description)) * 0.5
  score += recencyBonus(candidate.published_at)
  score += Math.min(candidate.favorites_count ?? 0, 20) * 0.05

  return score
}

export function rankSimilarListings(base: CatalogListing, candidates: CatalogListing[], limit = 4) {
  return candidates
    .map((item) => ({ item, score: scoreSimilarListing(base, item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return String(b.item.published_at ?? "").localeCompare(String(a.item.published_at ?? ""))
    })
    .slice(0, limit)
    .map((entry) => entry.item)
}
