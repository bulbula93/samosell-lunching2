import { describe, expect, it, vi } from "vitest"

const countResponse = vi.hoisted(() => ({ count: 49, error: null as null | { message: string } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/public-server", () => ({ createPublicServerClient: () => ({ from: () => {
  const query = { select: () => query, eq: () => query, or: () => query, abortSignal: () => Promise.resolve(countResponse) }
  return query
} }) }))

import { buildServerCatalogMetadata } from "@/lib/catalog-seo-server"

describe("pagination and empty-category SEO bounds", () => {
  it("indexes a populated category root", async () => {
    countResponse.count = 1
    countResponse.error = null
    expect(await buildServerCatalogMetadata({ category: "women" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/women" },
      robots: { index: true, follow: true },
    })
  })

  it("noindexes a confirmed empty category root while keeping its canonical", async () => {
    countResponse.count = 0
    countResponse.error = null
    expect(await buildServerCatalogMetadata({ category: "perfume" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/perfume" },
      robots: { index: false, follow: true },
    })
  })

  it("indexes existing pages with their own canonical", async () => {
    countResponse.count = 49
    countResponse.error = null
    expect(await buildServerCatalogMetadata({ category: "women", page: "3" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/women?page=3" },
      robots: { index: true, follow: true },
    })
  })

  it("noindexes empty out-of-range pages and consolidates to the category root", async () => {
    countResponse.count = 24
    countResponse.error = null
    expect(await buildServerCatalogMetadata({ category: "women", page: "2" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/women" },
      robots: { index: false, follow: true },
    })
  })

  it("noindexes unverified pagination during a public read failure", async () => {
    countResponse.error = { message: "upstream unavailable" }
    expect(await buildServerCatalogMetadata({ category: "women", page: "2" })).toMatchObject({
      robots: { index: false, follow: true },
    })
    countResponse.error = null
  })

  it("keeps a category root stable during a public read failure", async () => {
    countResponse.error = { message: "upstream unavailable" }
    expect(await buildServerCatalogMetadata({ category: "women" })).toMatchObject({
      robots: { index: true, follow: true },
    })
    countResponse.error = null
  })
})
