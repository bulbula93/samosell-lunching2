import "server-only"

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
function makeCachedReader() {
  return unstable_cache(executePublicQuery, ["anonymous-marketplace-v1"], { revalidate: 30, tags: ["public-listings", "public-sellers"] })
}
function makeBatchReader() {
  return unstable_cache(async (specs: (PublicQuery | null)[]) => {
    const supabase = createPublicServerClient()
    return Promise.all(specs.map((spec) => executePublicQuery(spec, supabase)))
  },
    ["anonymous-marketplace-batch-v1"], { revalidate: 30, tags: ["public-listings", "public-sellers"] })
}
let readPublicBatch: ReturnType<typeof makeBatchReader> | undefined

export async function getCachedPublicBatch(specs: (PublicQuery | null)[]) {
  readPublicBatch ??= makeBatchReader()
  return readPublicBatch(specs)
}
let readPublicQuery: ReturnType<typeof makeCachedReader> | undefined

export async function getCachedPublicRows<T>(spec: PublicQuery): Promise<{ data: T | null; count: number | null; error: null }> {
  readPublicQuery ??= makeCachedReader()
  return await readPublicQuery(spec) as { data: T | null; count: number | null; error: null }
}

