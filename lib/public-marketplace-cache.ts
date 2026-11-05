import "server-only"

import { listingTag, slugTag, sellerTag, categoryTag } from "@/lib/public-marketplace-tags"
import { unstable_cache } from "next/cache"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { withQueryTimeout } from "@/lib/supabase/query-timeout"

// Only anonymous public reads may enter this cache. Never pass a session client,
// cookies, favorites, blocks, notification counts or authorization results.
export type PublicQuery = {
  table: "listings_catalog" | "listing_images" | "profiles" | "listings"
  select: string
  eq?: [string, string][]
  neq?: [string, string][]
  order?: string
  ascending?: boolean
  limit?: number
  single?: boolean
  count?: boolean
  head?: boolean
}

async function executePublicQuery(spec: PublicQuery | null, supabase = createPublicServerClient()) {
  if (!spec) return { data: [], count: 0, error: null }
  let query = supabase.from(spec.table).select(spec.select, {
    ...(spec.count ? { count: "exact" as const } : {}),
    ...(spec.head ? { head: true } : {}),
  })
  for (const [column, value] of spec.eq ?? []) query = query.eq(column, value)
  for (const [column, value] of spec.neq ?? []) query = query.neq(column, value)
  if (spec.order) query = query.order(spec.order, { ascending: spec.ascending ?? false, nullsFirst: false })
  if (spec.limit) query = query.limit(spec.limit)
  const result = await withQueryTimeout<{ data: unknown; count: number | null; error: unknown }>((signal) =>
    spec.single ? query.abortSignal(signal).maybeSingle() : query.abortSignal(signal))
  // Throwing leaves the last good cache value intact during regeneration.
  if (result.error) throw new Error("PUBLIC_MARKETPLACE_QUERY_FAILED", { cause: result.error })
  return { data: result.data, count: result.count, error: null }
}
export function publicQueryTags(spec: PublicQuery | null): string[] {
  if (!spec) return []
  const eq = new Map(spec.eq ?? [])
  const tags = ["public-listings"] // explicit bulk/unknown-scope fallback
  if (spec.table === "profiles") tags.push("public-sellers")
  const seller = eq.get("seller_id") ?? (spec.table === "profiles" ? eq.get("id") : undefined)
  const listing = eq.get("listing_id") ?? (["listings", "listings_catalog"].includes(spec.table) ? eq.get("id") : undefined)
  const slug = eq.get("slug")
  if (seller) tags.push(sellerTag(seller))
  if (listing) tags.push(listingTag(listing))
  if (slug) tags.push(slugTag(slug))
  const category = eq.get("category_slug")
  if (category) tags.push("public-categories", categoryTag(category))
  if (!listing && !slug && !seller && !category) tags.push("public-feed")
  return [...new Set(tags)]
}

export async function getCachedPublicBatch(specs: (PublicQuery | null)[]) {
  // Creating a wrapper does not create an in-process key registry; Next owns
  // the persistent cache. Arguments remain part of the key.
  return unstable_cache(async (queries: (PublicQuery | null)[]) => {
    const supabase = createPublicServerClient()
    return Promise.all(queries.map((spec) => executePublicQuery(spec, supabase)))
  }, ["anonymous-marketplace-batch-v2"], {
    revalidate: 30, tags: [...new Set(specs.flatMap(publicQueryTags))],
  })(specs)
}

export async function getCachedPublicRows<T>(spec: PublicQuery): Promise<{ data: T | null; count: number | null; error: null }> {
  return await unstable_cache(executePublicQuery, ["anonymous-marketplace-v2"], {
    revalidate: 30, tags: publicQueryTags(spec),
  })(spec) as { data: T | null; count: number | null; error: null }
}
