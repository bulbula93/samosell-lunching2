import { describe, expect, it, vi } from "vitest"

const presenceResponse = vi.hoisted(() => ({
  data: [{ id: "listing-1" }] as Array<{ id: string }>,
  error: null as null | { message: string },
}))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/public-server", () => ({ createPublicServerClient: () => ({ from: () => {
  const query = {
    select: () => query,
    eq: () => query,
    or: () => query,
    range: () => query,
    abortSignal: () => Promise.resolve(presenceResponse),
  }
  return query
} }) }))

import { buildServerCatalogMetadata } from "@/lib/catalog-seo-server"

describe("pagination and empty-category SEO bounds", () => {
  it("indexes a populated category root", async () => {
    presenceResponse.data = [{ id: "listing-1" }]
    presenceResponse.error = null
    expect(await buildServerCatalogMetadata({ category: "women" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/women" },
      robots: { index: true, follow: true },
    })
  })

  it("noindexes a confirmed empty category root while keeping its canonical", async () => {
    presenceResponse.data = []
    presenceResponse.error = null
    expect(await buildServerCatalogMetadata({ category: "perfume" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/perfume" },
      robots: { index: false, follow: true },
    })
  })

  it("indexes an existing paginated page with its own canonical", async () => {
    presenceResponse.data = [{ id: "listing-49" }]
    presenceResponse.error = null
    expect(await buildServerCatalogMetadata({ category: "women", page: "3" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/women?page=3" },
      robots: { index: true, follow: true },
    })
  })

  it("noindexes an empty out-of-range page and consolidates to the category root", async () => {
    presenceResponse.data = []
    presenceResponse.error = null
    expect(await buildServerCatalogMetadata({ category: "women", page: "2" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/women" },
      robots: { index: false, follow: true },
    })
  })

  it("noindexes unverified pagination during a public read failure", async () => {
    presenceResponse.error = { message: "upstream unavailable" }
    expect(await buildServerCatalogMetadata({ category: "women", page: "2" })).toMatchObject({
      robots: { index: false, follow: true },
    })
    presenceResponse.error = null
  })

  it("keeps a category root stable during a public read failure", async () => {
    presenceResponse.error = { message: "upstream unavailable" }
    expect(await buildServerCatalogMetadata({ category: "women" })).toMatchObject({
      robots: { index: true, follow: true },
    })
    presenceResponse.error = null
  })
})
