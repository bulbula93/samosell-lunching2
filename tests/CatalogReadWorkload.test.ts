import { beforeEach, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), options: null as null | { revalidate: number; tags: string[] }, cache: new Map<string, unknown>(), failure: false }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, _keys: string[], options: { revalidate: number; tags: string[] }) => {
  mocks.options = options
  return async (...args: unknown[]) => {
    const key = JSON.stringify(args)
    if (mocks.cache.has(key)) return mocks.cache.get(key)
    const result = await fn(...args)
    mocks.cache.set(key, result)
    return result
  }
} }))
vi.mock("@/lib/supabase/public-server", () => ({ createPublicServerClient: () => mocks }))
import { getCachedCatalogFilterOptions } from "@/lib/catalog-filter-options"
beforeEach(() => {
  mocks.cache.clear(); mocks.from.mockClear(); mocks.rpc.mockClear(); mocks.failure = false
  const query = { select: () => query, order: () => query, abortSignal: async () => ({ data: [{ label: "M", group_name: "clothing", sort_order: 1 }], error: mocks.failure ? { message: "offline" } : null }) }
  mocks.from.mockReturnValue(query)
  mocks.rpc.mockImplementation(() => ({ abortSignal: async () => ({ data: { colors: ["შავი"], cities: ["თბილისი"] }, error: null }) }))
})
it("shares public filter options across consumers, with the existing five-minute revalidation contract", async () => {
  const first = await getCachedCatalogFilterOptions()
  const second = await getCachedCatalogFilterOptions()
  expect(second).toEqual(first)
  expect(first).toMatchObject({ sizes: [{ label: "M" }], colors: ["შავი"] })
  expect(mocks.from).toHaveBeenCalledOnce(); expect(mocks.rpc).toHaveBeenCalledOnce()
  expect(mocks.options).toEqual({ revalidate: 300, tags: ["catalog-public-filter-options"] })
})
it("never persists an outage as empty facet data", async () => {
  mocks.failure = true
  await expect(getCachedCatalogFilterOptions()).rejects.toThrow("catalog_public_options_failed")
  mocks.failure = false
  expect((await getCachedCatalogFilterOptions()).sizes).toHaveLength(1)
  expect(mocks.from).toHaveBeenCalledTimes(2)
})
it("uses the paged GET exact count for results and keeps mutations uncached", () => {
  const source = readFileSync("app/catalog/catalog-view.tsx", "utf8")
  expect(source).toContain('select(CATALOG_LISTING_SELECT, { count: "exact" })')
  expect(source).toContain("listingsResponse.count ?? 0")
  expect(source).not.toContain("head: true")
  expect(source).toContain('supabase.from("favorites")')
})
