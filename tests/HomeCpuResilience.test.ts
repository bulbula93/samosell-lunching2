import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { makeListing } from "@/tests/fixtures"

const mocks = vi.hoisted(() => ({ read: vi.fn(), select: vi.fn() }))
vi.mock("@/lib/supabase/public-server", () => ({
  createPublicServerClient: () => ({ from: () => {
    const query = { select: mocks.select.mockImplementation(() => query), eq: () => query,
      order: () => query, limit: () => query, abortSignal: mocks.read }
    return query
  } }),
}))
vi.mock("next/cache", () => ({ unstable_cache: (load: () => Promise<unknown>) => {
  let hasValue = false
  let value: unknown
  return async () => {
    if (hasValue) return value
    value = await load()
    hasValue = true
    return value
  }
} }))

beforeEach(() => {
  vi.resetModules()
  mocks.read.mockReset()
  mocks.select.mockReset()
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe("homepage public upstream work", () => {
  it("coalesces simultaneous cold cache reads", async () => {
    mocks.read.mockResolvedValue({ data: [makeListing()], count: 1, error: null, status: 200 })
    const { getPublicHomePageData } = await import("@/lib/home-page")
    const pages = await Promise.all(Array.from({ length: 10 }, () => getPublicHomePageData()))
    expect(pages.every((page) => page.activeCount === 1)).toBe(true)
    expect(mocks.read).toHaveBeenCalledOnce()
  })

  it("does not launch a second query after a timeout or on the next request during cooldown", async () => {
    vi.useFakeTimers()
    mocks.read.mockImplementation(() => new Promise(() => {}))
    const { getPublicHomePageData } = await import("@/lib/home-page")
    const page = getPublicHomePageData()
    const rejected = expect(page).rejects.toThrow("home_public_data_unavailable")
    await vi.advanceTimersByTimeAsync(15_000)
    await rejected
    await expect(getPublicHomePageData()).rejects.toThrow("public_loader_cooling_down")
    expect(mocks.read).toHaveBeenCalledOnce()
    expect(mocks.read.mock.calls[0][0].aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("only retries quick server failures, using a query without an exact count", async () => {
    mocks.read.mockResolvedValueOnce({ data: null, error: { message: "upstream unavailable" }, status: 503 })
      .mockResolvedValueOnce({ data: [makeListing()], error: null, status: 200 })
    const { getPublicHomePageData } = await import("@/lib/home-page")
    expect((await getPublicHomePageData()).activeCount).toBe(1)
    expect(mocks.read).toHaveBeenCalledTimes(2)
    expect(mocks.select.mock.calls[0][1]).toEqual({ count: "exact" })
    expect(mocks.select.mock.calls[1]).toHaveLength(1)
  })

  it("shares one deadline across both attempts instead of adding a fresh retry window", async () => {
    vi.useFakeTimers()
    mocks.read.mockImplementationOnce(() => new Promise((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: "unavailable" }, status: 503 }), 10_000)
    })).mockImplementationOnce(() => new Promise(() => {}))
    const { getPublicHomePageData } = await import("@/lib/home-page")
    const page = getPublicHomePageData()
    const rejected = expect(page).rejects.toThrow("home_public_data_unavailable")
    await vi.advanceTimersByTimeAsync(14_999)
    expect(mocks.read).toHaveBeenCalledTimes(2)
    expect(mocks.read.mock.calls[1][0].aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejected
    expect(mocks.read.mock.calls[1][0].aborted).toBe(true)
  })

  it.each([400, 401, 403, 429])("does not amplify a permanent or rate-limited HTTP %i response", async (status) => {
    mocks.read.mockResolvedValue({ data: null, error: { message: "unavailable" }, status })
    const { getPublicHomePageData } = await import("@/lib/home-page")
    await expect(getPublicHomePageData()).rejects.toThrow("home_public_data_unavailable")
    expect(mocks.read).toHaveBeenCalledOnce()
  })

  it("removes expired promotions from cached rails and badges without querying again", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-18T15:00:00Z"))
    const until = "2026-10-18T15:00:01Z"
    mocks.read.mockResolvedValue({ data: [makeListing({
      is_vip: true, is_promoted: true, is_featured: true, is_home_banner: true,
      vip_until: until, promoted_until: until, featured_until: until, home_banner_until: until,
      cover_image_url: "/cover.jpg",
    })], count: 1, error: null, status: 200 })
    const { getPublicHomePageData } = await import("@/lib/home-page")
    const first = await getPublicHomePageData()
    expect(first.heroItems).toHaveLength(1)
    expect(first.vipItems).toHaveLength(1)
    vi.setSystemTime(new Date("2026-10-18T15:00:02Z"))
    const expired = await getPublicHomePageData()
    expect(expired.heroItems).toHaveLength(0)
    expect(expired.vipItems).toHaveLength(0)
    expect(expired.bannerItems).toHaveLength(0)
    expect(expired.latestItems[0]).toMatchObject({ is_vip: false, is_promoted: false, is_featured: false, promotion_tier: 0 })
    expect(mocks.read).toHaveBeenCalledOnce()
  })
})
