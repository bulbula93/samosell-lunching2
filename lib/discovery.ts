import type { CatalogListing } from "@/types/marketplace"

const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u
const GENERIC_TOKENS = new Set([
  "ახალი",
  "ნივთი",
  "ტანსაცმელი",
  "ქალის",
  "ქალებისთვის",
  "მამაკაცის",
  "მამაკაცებისთვის",
  "ბავშვის",
  "ბავშვებისთვის",
  "unisex",
])

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ka-GE")
}

function identityTokens(item: CatalogListing) {
  const text = [item.title, item.brand_name].filter(Boolean).join(" ")
  return normalize(text)
    .split(TOKEN_SPLIT)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token))
}

function tokensMatch(left: string, right: string) {
  if (left === right) return true
  if (left.length < 4 || right.length < 4) return false
  return left.slice(0, 4) === right.slice(0, 4)
}

function tokenAffinity(seed: CatalogListing, candidate: CatalogListing) {
  const seedTokens = identityTokens(seed)
  const candidateTokens = identityTokens(candidate)
  if (seedTokens.length === 0 || candidateTokens.length === 0) return 0

  let matches = 0
  for (const token of seedTokens) {
    if (candidateTokens.some((candidateToken) => tokensMatch(token, candidateToken))) {
      matches += 1
    }
  }

  return matches / seedTokens.length
}

function sameText(left: unknown, right: unknown) {
  const a = normalize(left)
  const b = normalize(right)
  return Boolean(a && b && a === b)
}

function priceAffinity(seedPrice: number, candidatePrice: number) {
  const seed = Number(seedPrice)
  const candidate = Number(candidatePrice)
  if (!Number.isFinite(seed) || !Number.isFinite(candidate)) return 0
  const denominator = Math.max(Math.abs(seed), Math.abs(candidate), 1)
  return Math.max(0, 1 - Math.abs(seed - candidate) / denominator)
}

function freshnessScore(value?: string | null) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 0
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000)
  if (ageDays <= 7) return 3
  if (ageDays <= 30) return 2
  if (ageDays <= 90) return 1
  return 0
}

export function similarListingScore(seed: CatalogListing, candidate: CatalogListing) {
  let score = 0

  if (sameText(seed.category_slug, candidate.category_slug)) score += 38
  if (sameText(seed.brand_name, candidate.brand_name)) score += 22
  if (sameText(seed.size_label, candidate.size_label)) score += 9
  if (sameText(seed.gender, candidate.gender)) score += 7
  if (sameText(seed.condition, candidate.condition)) score += 5
  if (sameText(seed.color, candidate.color)) score += 4
  if (sameText(seed.material, candidate.material)) score += 4
  if (sameText(seed.city, candidate.city)) score += 2

  score += tokenAffinity(seed, candidate) * 22
  score += priceAffinity(seed.price, candidate.price) * 10
  score += freshnessScore(candidate.published_at)
  score += candidate.cover_image_url ? 2 : 0
  score += Math.min(3, Math.log1p(Math.max(0, candidate.favorites_count ?? 0)))
  score += Math.min(2, Math.log1p(Math.max(0, candidate.views_count ?? 0)) / 2)
  score += Math.min(3, Math.max(0, candidate.promotion_tier ?? 0))

  return score
}

export function rankSimilarListings(
  seed: CatalogListing,
  candidates: CatalogListing[],
  limit = 8,
) {
  const deduped = Array.from(
    new Map(
      candidates
        .filter((item) => item.id !== seed.id && item.status !== "sold")
        .map((item) => [item.id, item] as const),
    ).values(),
  )

  const ranked = deduped
    .map((item) => ({ item, score: similarListingScore(seed, item) }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      const rightDate = new Date(right.item.published_at ?? 0).getTime() || 0
      const leftDate = new Date(left.item.published_at ?? 0).getTime() || 0
      return rightDate - leftDate
    })

  const selected: CatalogListing[] = []
  const sellerCounts = new Map<string, number>()
  const deferred: CatalogListing[] = []

  for (const entry of ranked) {
    if (selected.length >= limit) break
    const sellerId = entry.item.seller_id || ""
    const sellerCount = sellerId ? sellerCounts.get(sellerId) ?? 0 : 0

    if (sellerId && sellerCount >= 2) {
      deferred.push(entry.item)
      continue
    }

    selected.push(entry.item)
    if (sellerId) sellerCounts.set(sellerId, sellerCount + 1)
  }

  for (const item of deferred) {
    if (selected.length >= limit) break
    selected.push(item)
  }

  return selected
}
