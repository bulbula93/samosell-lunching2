// @vitest-environment node
import { describe, expect, it, beforeEach, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listingsFailed: false,
  sellersFailed: false,
  transportRejected: false,
  listings: [{ slug: "test-listing", updated_at: "2026-10-06T00:00:00Z" }],
  sellers: [{ seller_username: "test-seller", published_at: "2026-10-06T00:00:00Z" }],
}))

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => fn,
}))

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicServerClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        abortSignal: async () => {
          if (mocks.transportRejected) throw new Error("network timeout")
          return table === "listings"
          ? { data: mocks.listings, error: mocks.listingsFailed ? { message: "timeout" } : null }
          : { data: mocks.sellers, error: mocks.sellersFailed ? { message: "timeout" } : null }
        },
      }
      return query
    },
  }),
}))

import sitemap from "@/app/sitemap"

beforeEach(() => {
  mocks.listingsFailed = false
  mocks.sellersFailed = false
  mocks.transportRejected = false
})

describe("SEO sitemap outage resistance", () => {
  const urls = async () => (await sitemap()).map((row) => row.url)

  it("always includes all eight canonical category URLs", async () => {
    const result = await urls()
    for (const category of ["women", "men", "kids", "footwear", "bags", "vintage", "accessories", "perfume"]) {
      expect(result).toContain(`https://samosell.ge/catalog/${category}`)
    }
    expect(result.some((url) => url.includes("?category="))).toBe(false)
  })

  it("uses live active listings and sellers after successful refresh", async () => {
    const result = await urls()
    expect(result).toContain("https://samosell.ge/listing/test-listing")
    expect(result).toContain("https://samosell.ge/seller/test-seller")
    expect(result).not.toContain("https://samosell.ge/listing/zara-9d595c9d")
  })

  it.each(["listings", "sellers"] as const)("keeps backed-up URLs when %s API times out", async (failed) => {
    mocks[failed === "listings" ? "listingsFailed" : "sellersFailed"] = true
    const result = await urls()
    expect(result).toContain("https://samosell.ge/catalog/perfume")
    expect(result).toContain("https://samosell.ge/listing/zara-9d595c9d")
    expect(result.some((url) => url.startsWith("https://samosell.ge/seller/"))).toBe(true)
    expect(result.length).toBeGreaterThan(70)
  })

  it("retains the last-known-good URLs after a thrown network abort", async () => {
    mocks.transportRejected = true
    const result = await urls()
    expect(result).toContain("https://samosell.ge/catalog/women")
    expect(result).toContain("https://samosell.ge/listing/zara-9d595c9d")
  })

  it("does not publish a stale snapshot when a healthy DB confirms no active listings", async () => {
    const oldListings = mocks.listings
    const oldSellers = mocks.sellers
    try {
      mocks.listings = []
      mocks.sellers = []
      const result = await urls()
      expect(result.some((url) => url.includes("/listing/"))).toBe(false)
      expect(result).toContain("https://samosell.ge/catalog/vintage")
    } finally {
      mocks.listings = oldListings
      mocks.sellers = oldSellers
    }
  })
})
