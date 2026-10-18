import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), session: vi.fn() }))
vi.mock("@/lib/home-page", () => ({ getPublicHomePageData: mocks.catalog }))
vi.mock("@/lib/ad-data", () => ({ getActiveAdRotation: async () => [] }))
vi.mock("@/components/layout/SiteHeader", () => ({ getMarketplaceNavigationItems: async () => [] }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.session }))
import Home, { revalidate } from "@/app/page"

beforeEach(() => { vi.resetAllMocks() })
describe("public homepage ISR", () => {
  it("fails regeneration instead of caching a fake empty marketplace", async () => {
    mocks.catalog.mockRejectedValue(new Error("catalog unavailable"))
    await expect(Home()).rejects.toThrow("catalog unavailable")
    expect(revalidate).toBe(60)
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it("builds its shared tree without a cookie-bound session client", async () => {
    mocks.catalog.mockResolvedValue({ heroItems: [], vipItems: [], bannerItems: [], latestItems: [], popularItems: [], affordableItems: [], vintageItems: [], popularBrands: [], activeCount: 0 })
    await expect(Home()).resolves.toBeTruthy()
    expect(mocks.session).not.toHaveBeenCalled()
  })
})
