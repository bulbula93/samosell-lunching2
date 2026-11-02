import { beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ user: "A", publicReads: vi.fn(), entries: new Map<string, unknown>(), privateClient: vi.fn() }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: never[]) => Promise<unknown>, keys: string[]) => async (...args: never[]) => {
  const key = JSON.stringify([keys, args])
  if (!state.entries.has(key)) state.entries.set(key, await fn(...args))
  return state.entries.get(key)
} }))
vi.mock("@/lib/browser-consent-server", () => ({ serverAllowsAnalytics: async () => false }))
vi.mock("@/lib/catalog-filter-options", () => ({ getCachedCatalogFilterOptions: async () => ({ sizes: [], colors: [], cities: [] }) }))
vi.mock("@/lib/supabase/public-server", () => ({ createPublicServerClient: () => ({ from: () => {
  const query = { select: () => query, eq: () => query, or: () => query, order: () => query, range: () => query, abortSignal: state.publicReads }
  return query
} }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: state.privateClient }))
import CatalogView from "@/app/catalog/catalog-view"
import CatalogResultsGrid from "@/components/listings/CatalogResultsGrid"
import SiteHeader from "@/components/layout/SiteHeader"
import { publicBrowseKey, getCachedPublicBrowse } from "@/lib/catalog-public-data"
import { resolveCatalogState } from "@/lib/catalog-page"
import { makeListing } from "@/tests/fixtures"
import type { ReactElement, ReactNode } from "react"
function propsFor(node: ReactNode, type: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(child => propsFor(child, type))
  if (!node || typeof node !== "object" || !("props" in node)) return []
  const el = node as ReactElement<{ children?: ReactNode }>
  return [...(el.type === type ? [el.props] : []), ...propsFor(el.props.children, type)]
}
beforeEach(() => {
  state.entries.clear(); state.publicReads.mockReset().mockResolvedValue({ data: [makeListing()], count: 1, error: null })
  state.privateClient.mockReset().mockImplementation(async () => {
    const user = state.user
    const chain = { select: () => chain, eq: () => chain, order: () => chain, abortSignal: async () => ({ data: [{ listing_id: user }], error: null }) }
    return { auth: { getUser: async () => ({ data: { user: { id: user } } }) }, from: () => chain }
  })
})
describe("bounded public catalog and private viewers", () => {
  it("shares public SSR content but never favorites or header identity between A and B", async () => {
    state.user = "A"; const a = await CatalogView({})
    state.user = "B"; const b = await CatalogView({})
    expect(state.publicReads).toHaveBeenCalledOnce()
    expect(propsFor(a, CatalogResultsGrid)[0]).toMatchObject({ favoriteIds: ["A"], listings: [expect.objectContaining({ id: "listing-1" })] })
    expect(propsFor(b, CatalogResultsGrid)[0]).toMatchObject({ favoriteIds: ["B"] })
    expect(propsFor(a, SiteHeader)[0]).toMatchObject({ authenticatedUser: { id: "A" } })
    expect(propsFor(b, SiteHeader)[0]).toMatchObject({ authenticatedUser: { id: "B" } })
  })
  it.each([{ q: "dress" }, { brand: "Zara" }, { page: "4" }, { sort: "price_asc" }, { recent: "7" }, { category: "arbitrary" }])("keeps unbounded/filter combinations out of shared cache: %j", params => {
    const { filters, sort, page } = resolveCatalogState(params)
    expect(publicBrowseKey(filters, sort, page)).toBeNull()
  })
  it("checks the key boundary before any upstream read", async () => {
    await expect(getCachedPublicBrowse({ category: "women", page: 999, sort: "latest" })).rejects.toThrow("invalid_public_browse_key")
    expect(state.publicReads).not.toHaveBeenCalled()
  })
  it("does not store a failed read as a successful empty page", async () => {
    state.publicReads.mockResolvedValueOnce({ data: null, error: { message: "offline" } })
    const key = { category: "women", page: 1, sort: "latest" as const }
    await expect(getCachedPublicBrowse(key)).rejects.toThrow("public_catalog_failed")
    expect((await getCachedPublicBrowse(key)).data).toHaveLength(1)
    expect(state.publicReads).toHaveBeenCalledTimes(2)
  })
})
