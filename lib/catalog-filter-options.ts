import "server-only"
import { unstable_cache } from "next/cache"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { withQueryTimeout } from "@/lib/supabase/query-timeout"

type CatalogFilterOptions = {
  sizes: Array<{ label: string; group_name: string; sort_order: number }>
  colors: string[]
  cities: string[]
}

export const getCachedCatalogFilterOptions = unstable_cache(
  async (): Promise<CatalogFilterOptions> => {
    const supabase = createPublicServerClient()
    const [sizesResponse, facetsResponse] = await Promise.all([
      withQueryTimeout(supabase
        .from("sizes")
        .select("label, group_name, sort_order")
        .order("group_name", { ascending: true })
        .order("sort_order", { ascending: true })),
      withQueryTimeout(supabase.rpc("get_catalog_public_facets")),
    ])

    const publicOptionsError = sizesResponse.error || facetsResponse.error
    if (publicOptionsError) {
      throw new Error(`catalog_public_options_failed:${publicOptionsError.message}`)
    }

    const facets = (facetsResponse.data ?? {}) as {
      colors?: unknown
      cities?: unknown
    }
    const normalizeList = (value: unknown) =>
      Array.isArray(value)
        ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
        : []

    return {
      sizes: (sizesResponse.data ?? []) as CatalogFilterOptions["sizes"],
      colors: normalizeList(facets.colors),
      cities: normalizeList(facets.cities),
    }
  },
  ["catalog-public-filter-options-v1"],
  {
    revalidate: 300,
    tags: ["catalog-public-filter-options"],
  },
)

