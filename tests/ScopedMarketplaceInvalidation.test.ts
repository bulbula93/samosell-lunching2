import { beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ entries: new Map<string, { value: unknown; tags: string[] }>(), read: vi.fn() }))
vi.mock("next/cache", () => ({
  unstable_cache: (load: (...args: never[]) => Promise<unknown>, keys: string[], options: { tags: string[] }) => async (...args: never[]) => {
    const key = JSON.stringify([keys, args])
    if (state.entries.has(key)) return state.entries.get(key)!.value
    const value = await load(...args)
    state.entries.set(key, { value, tags: options.tags })
    return value
  },
  revalidateTag: (tag: string) => { for (const [key, entry] of state.entries) if (entry.tags.includes(tag)) state.entries.delete(key) },
  revalidatePath: vi.fn(),
}))
vi.mock("@/lib/supabase/public-server", () => ({ createPublicServerClient: () => ({ from: () => {
  const query = { select: () => query, eq: () => query, abortSignal: () => query, maybeSingle: state.read }
  return query
} }) }))
import { getCachedPublicRows } from "@/lib/public-marketplace-cache"
import { invalidatePublicMarketplace } from "@/lib/public-marketplace-invalidation"
import { marketplaceChangeTags } from "@/lib/public-marketplace-tags"
const read = (id: string, seller: string) => getCachedPublicRows({ table: "listings_catalog", select: "id, title", eq: [["id", id], ["seller_id", seller]], single: true })
beforeEach(() => { state.entries.clear(); state.read.mockReset().mockResolvedValue({ data: { title: "before" }, count: null, error: null }) })
describe("scoped marketplace invalidation", () => {
  it("updates the affected listing after a mutation and keeps another seller warm", async () => {
    await read("A", "seller-A"); await read("B", "seller-B")
    state.read.mockResolvedValue({ data: { title: "after" }, count: null, error: null })
    invalidatePublicMarketplace({ listingId: "A", sellerId: "seller-A" })
    expect(await read("A", "seller-A")).toMatchObject({ data: { title: "after" } })
    expect(await read("B", "seller-B")).toMatchObject({ data: { title: "before" } })
    expect(state.read).toHaveBeenCalledTimes(3) // broad baseline requires four reads
  })
  it("expires every representation of a changed seller but keeps another seller warm", async () => {
    await read("A1", "A"); await read("A2", "A"); await read("B1", "B")
    invalidatePublicMarketplace({ sellerId: "A" })
    await read("A1", "A"); await read("A2", "A"); await read("B1", "B")
    expect(state.read).toHaveBeenCalledTimes(5)
  })
  it("includes both categories and both slugs on a move", () => {
    const tags = marketplaceChangeTags({ listingId: "A", sellerId: "S", slug: "new", previousSlug: "old", categories: ["women", "men"] })
    expect(tags).toEqual(expect.arrayContaining(["public-category:women", "public-category:men", "public-listing-slug:old", "public-listing-slug:new", "public-feed", "home-public-data"]))
    expect(tags).not.toContain("public-listings")
  })
  it("safely expires all category feeds when mutation scope is unknown", () => {
    expect(marketplaceChangeTags({ listingId: "A", sellerId: "S" })).toContain("public-categories")
    expect(marketplaceChangeTags()).toEqual(["home-public-data", "public-listings", "public-sellers"])
  })
})
