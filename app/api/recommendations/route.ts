import { NextResponse } from "next/server"
import { similarListingScore } from "@/lib/discovery"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

const LISTING_SELECT =
  "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, cover_image_url, published_at, favorites_count, views_count, status"

const MAX_RECENT_IDS = 12
const MAX_FAVORITE_SEEDS = 8
const MAX_SEEDS = 12
const MAX_CANDIDATES = 160
const RESULT_LIMIT = 10

function validId(value: string) {
  return /^[a-f0-9-]{36}$/i.test(value)
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}

function selectRecommendations(seeds: CatalogListing[], candidates: CatalogListing[]) {
  const seedIds = new Set(seeds.map((item) => item.id))

  const ranked = candidates
    .filter((item) => !seedIds.has(item.id) && item.status !== "sold")
    .map((item) => {
      let score = 0

      seeds.forEach((seed, index) => {
        const recencyWeight = Math.max(0.72, 1 - index * 0.04)
        score = Math.max(score, similarListingScore(seed, item) * recencyWeight)
      })

      return { item, score }
    })
    .filter((entry) => entry.score > 0)
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
    if (selected.length >= RESULT_LIMIT) break

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
    if (selected.length >= RESULT_LIMIT) break
    selected.push(item)
  }

  return selected
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const recentIds = unique(
    (searchParams.get("ids") || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => validId(item))
  ).slice(0, MAX_RECENT_IDS)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const favoriteResponse = user
    ? await supabase
        .from("favorites")
        .select("listing_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(MAX_FAVORITE_SEEDS)
    : { data: [] as { listing_id: string }[], error: null }

  const favoriteIds = favoriteResponse.error
    ? []
    : (favoriteResponse.data ?? []).map((row) => row.listing_id).filter((id): id is string => validId(id))

  const seedIds = unique([...recentIds, ...favoriteIds]).slice(0, MAX_SEEDS)

  if (seedIds.length === 0) {
    return NextResponse.json(
      { items: [] },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  }

  const seedResponse = await supabase
    .from("listings_catalog")
    .select(LISTING_SELECT)
    .in("id", seedIds)

  if (seedResponse.error) {
    return NextResponse.json(
      { items: [] },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  }

  const orderMap = new Map(seedIds.map((id, index) => [id, index]))
  const seeds = ((seedResponse.data ?? []) as CatalogListing[]).sort(
    (left, right) =>
      (orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  )

  if (seeds.length === 0) {
    return NextResponse.json(
      { items: [] },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  }

  const categorySlugs = unique(
    seeds.map((item) => item.category_slug).filter((value): value is string => Boolean(value)),
  ).slice(0, 8)

  let candidatesQuery = supabase
    .from("listings_catalog")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(MAX_CANDIDATES)

  if (categorySlugs.length > 0) {
    candidatesQuery = candidatesQuery.in("category_slug", categorySlugs)
  }

  const candidateResponse = await candidatesQuery

  if (candidateResponse.error) {
    return NextResponse.json(
      { items: [] },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    )
  }

  const items = selectRecommendations(
    seeds,
    (candidateResponse.data ?? []) as CatalogListing[],
  )

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  )
}
