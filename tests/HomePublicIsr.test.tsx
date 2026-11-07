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
    expect(revalidate).toBe(600)
    expect(mocks.session).not.toHaveBeenCalled()
  })
  it("builds its shared tree without a cookie-bound session client", async () => {
    mocks.catalog.mockResolvedValue({ heroItems: [], vipItems: [], bannerItems: [], latestItems: [], popularItems: [], affordableItems: [], vintageItems: [], popularBrands: [], activeCount: 0 })
    await expect(Home()).resolves.toBeTruthy()
    expect(mocks.session).not.toHaveBeenCalled()
  })
})

import { readFileSync } from "node:fs"
describe("homepage freshness without per-minute regeneration", () => {
  it.each(["app/dashboard/listings/form-actions.ts", "app/dashboard/listings/actions.ts", "app/admin/actions.ts"])("%s revalidates the homepage wherever it revalidates the catalog", (file) => {
    const src = readFileSync(file, "utf8")
    const catalog = src.match(/revalidatePath\("\/catalog"\)/g)?.length ?? 0
    expect(catalog).toBeGreaterThan(0)
    expect(src.match(/revalidatePath\("\/"\)/g)?.length).toBe(catalog)
  })
})
