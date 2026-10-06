// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => {
    const filters: Record<string, unknown> = {}
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query },
      or: () => query,
      order: () => query,
      limit: async () => table === "listings"
        ? { data: [{ slug: "test-listing", updated_at: "2026-10-06" }], error: null }
        : Object.keys(filters).length === 1
          ? { data: [{ seller_username: "test-seller", published_at: "2026-10-06" }], error: null }
          : { count: filters.category_slug === "vintage" ? 0 : 1, data: [{ published_at: "2026-10-06" }], error: null },
    }
    return query
  } }),
}))

import sitemap from "@/app/sitemap"

describe("clean category sitemap", () => {
  it("lists only populated clean categories, retaining listing and seller entries", async () => {
    const urls = (await sitemap()).map((entry) => entry.url)
    expect(urls).toContain("https://samosell.ge/catalog/women")
    expect(urls).toContain("https://samosell.ge/catalog/accessories")
    expect(urls).toContain("https://samosell.ge/catalog/perfume")
    expect(urls).not.toContain("https://samosell.ge/catalog/vintage")
    expect(urls).toContain("https://samosell.ge/listing/test-listing")
    expect(urls).toContain("https://samosell.ge/seller/test-seller")
    expect(urls.some((url) => url.includes("?category="))).toBe(false)
    expect(urls.some((url) => /favicon|opengraph-image|\/&$|\/\$$/.test(url))).toBe(false)
  })
})
