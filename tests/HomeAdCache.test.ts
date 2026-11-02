import { beforeEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ read: vi.fn(), cache: vi.fn() }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown, keys: string[], options: unknown) => { state.cache(keys, options); return fn } }))
vi.mock("@/lib/supabase/public-server", () => ({ createPublicServerClient: () => ({ from: () => {
  const q = { select: () => q, eq: () => q, in: () => q, order: () => q, then: (resolve: (r: unknown) => unknown) => state.read().then(resolve) }
  return q
} }) }))
beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })
it("uses a separate 300s cache for home and propagates its upstream failure", async () => {
  state.read.mockResolvedValue({ data: [], error: { message: "offline" } })
  const { getActiveAdRotation } = await import("@/lib/ad-data")
  await expect(getActiveAdRotation(["home_hero_left"], { home: true })).rejects.toThrow("active_ads_failed")
  expect(state.cache).toHaveBeenCalledWith(["home-ad-rows-v1"], { revalidate: 300, tags: ["active-ads"] })
  expect(state.cache).toHaveBeenCalledWith(["active-ad-rows-v2"], { revalidate: 60, tags: ["active-ads"] })
})
