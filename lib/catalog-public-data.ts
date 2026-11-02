import "server-only"
import { unstable_cache } from "next/cache"
import { applyCatalogFilters, PAGE_SIZE, type CatalogFilters } from "@/lib/catalog-page"
import { isCatalogCategory } from "@/lib/catalog-urls"
import { categoryTag } from "@/lib/public-marketplace-tags"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { withQueryTimeout } from "@/lib/supabase/query-timeout"
import { refreshPromotion } from "@/lib/promotion-expiry"
import type { CatalogListing } from "@/types/marketplace"

export const CATALOG_LISTING_SELECT = "id, public_id, slug, title, price, currency, condition, sale_type, city, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, promotion_tier, brand_name, size_label, category_name, seller_username, seller_full_name, seller_is_verified, seller_type, seller_avatar_url, seller_store_logo_url, cover_image_url, status"
export type PublicBrowseKey = { category: string; page: number; sort: "relevance" | "latest" }

/** Finite key space: 9 category choices x 3 pages x 2 sort choices = 54. */
export function publicBrowseKey(filters: CatalogFilters, sort: string, page: number): PublicBrowseKey | null {
  if (!Number.isInteger(page) || page < 1 || page > 3 || !["relevance", "latest"].includes(sort)) return null
  if (filters.category && !isCatalogCategory(filters.category)) return null
  if (Object.entries(filters).some(([key, value]) => key !== "category" && Boolean(value))) return null
  return { category: filters.category, page, sort: sort as PublicBrowseKey["sort"] }
}

async function loadPublicBrowse(key: PublicBrowseKey) {
  // No cookie client, viewer key, favorites, blocks, claims or authorization.
  const supabase = createPublicServerClient()
  const query = applyCatalogFilters(supabase.from("listings_catalog")
    .select(CATALOG_LISTING_SELECT, { count: "exact" }).eq("status", "active"), { category: key.category })
    .order("promotion_tier", { ascending: false })
    .order("featured_slot", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
  const from = (key.page - 1) * PAGE_SIZE
  const result = await withQueryTimeout(query.range(from, from + PAGE_SIZE - 1))
  if (result.error) throw new Error("public_catalog_failed", { cause: result.error })
  return { data: (result.data ?? []) as CatalogListing[], count: result.count, error: null }
}

export async function getCachedPublicBrowse(key: PublicBrowseKey) {
  // Validate even internal callers before creating a persistent cache entry.
  if (!(key.category === "" || isCatalogCategory(key.category)) || !Number.isInteger(key.page) || key.page < 1 || key.page > 3 || !["relevance", "latest"].includes(key.sort)) throw new Error("invalid_public_browse_key")
  const tags = ["public-listings", ...(key.category ? ["public-categories", categoryTag(key.category)] : ["public-feed"])]
  const result = await unstable_cache(loadPublicBrowse, ["public-catalog-browse-v1"], { revalidate: 30, tags })(key)
  return { ...result, data: result.data.map(item => refreshPromotion(item)) }
}
