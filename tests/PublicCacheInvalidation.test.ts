import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ tag: vi.fn(), path: vi.fn(), client: vi.fn(), limit: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: mocks.tag, revalidatePath: mocks.path }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }))
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.limit }))
import { invalidatePublicMarketplace } from "@/lib/public-marketplace-invalidation"
import { refreshPublicProfileAction } from "@/app/dashboard/profile/actions"

beforeEach(() => { vi.resetAllMocks() })
describe("public data invalidation", () => {
  it("immediately expires public data and the cached homepage together", () => {
    invalidatePublicMarketplace()
    expect(mocks.tag.mock.calls).toEqual(["home-public-data", "public-listings", "public-sellers"].map((tag) => [tag, { expire: 0 }]))
    expect(mocks.path).toHaveBeenCalledWith("/")
  })
  it("does not allow an anonymous caller to purge the public cache", async () => {
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } })
    await expect(refreshPublicProfileAction()).resolves.toEqual({ ok: false })
    expect(mocks.tag).not.toHaveBeenCalled()
  })
  it("rate-limits authenticated profile refreshes before invalidation", async () => {
    mocks.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) } })
    mocks.limit.mockRejectedValue(new Error("rate limited"))
    await expect(refreshPublicProfileAction()).rejects.toThrow("rate limited")
    expect(mocks.tag).not.toHaveBeenCalled()
  })
})
