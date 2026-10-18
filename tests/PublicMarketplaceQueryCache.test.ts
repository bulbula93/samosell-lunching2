import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ read: vi.fn(), cache: vi.fn() }))
vi.mock("next/cache", () => ({ unstable_cache: (load: (...args: unknown[]) => Promise<unknown>, keys: string[], options: unknown) => {
  mocks.cache(keys, options)
  const values = new Map<string, unknown>()
  return async (...args: unknown[]) => {
    const key = JSON.stringify(args)
    if (values.has(key)) return values.get(key)
    const result = await load(...args)
    values.set(key, result)
    return result
  }
} }))
vi.mock("@/lib/supabase/public-server", () => ({ createPublicServerClient: () => ({ from: (table: string) => {
  const filters: string[][] = []
  const query = { select: () => query, eq: (column: string, value: string) => { filters.push([column, value]); return query },
    maybeSingle: () => query, abortSignal: () => query,
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => mocks.read(table, filters).then(resolve, reject) }
  return query
} }) }))
beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

describe("anonymous public query cache", () => {
  it("shares identical reads but keeps different seller keys separate", async () => {
    mocks.read.mockImplementation(async (_table, filters) => ({ data: { id: filters[0][1] }, count: null, error: null }))
    const { getCachedPublicRows } = await import("@/lib/public-marketplace-cache")
    const read = (id: string) => getCachedPublicRows({ table: "profiles", select: "id, username", eq: [["id", id]], single: true })
    await expect(read("seller-A")).resolves.toMatchObject({ data: { id: "seller-A" } })
    await read("seller-A")
    await expect(read("seller-B")).resolves.toMatchObject({ data: { id: "seller-B" } })
    expect(mocks.read).toHaveBeenCalledTimes(2)
    expect(mocks.cache).toHaveBeenCalledWith(["anonymous-marketplace-v1"], { revalidate: 30, tags: ["public-listings", "public-sellers"] })
  })
  it("does not cache a database failure as empty successful public data", async () => {
    mocks.read.mockResolvedValueOnce({ data: null, error: { message: "unavailable" } })
      .mockResolvedValueOnce({ data: { id: "seller-A" }, count: null, error: null })
    const { getCachedPublicRows } = await import("@/lib/public-marketplace-cache")
    const spec = { table: "profiles" as const, select: "id", single: true }
    await expect(getCachedPublicRows(spec)).rejects.toThrow("PUBLIC_MARKETPLACE_QUERY_FAILED")
    await expect(getCachedPublicRows(spec)).resolves.toMatchObject({ data: { id: "seller-A" } })
    expect(mocks.read).toHaveBeenCalledTimes(2)
  })
})
