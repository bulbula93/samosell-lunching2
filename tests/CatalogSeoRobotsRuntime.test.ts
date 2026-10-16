import { describe, expect, it } from "vitest"
import { buildServerCatalogMetadata } from "@/lib/catalog-seo-server"
import { buildCatalogMetadata } from "@/lib/catalog-seo"

describe("canonical catalog robots regression", () => {
  it.each(["women", "men", "kids", "accessories", "footwear", "bags", "vintage", "perfume"])("indexes clean %s route", async (category) => {
    const metadata = await buildServerCatalogMetadata({ category })
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(metadata.alternates?.canonical).toBe(`https://samosell.ge/catalog/${category}`)
  })

  it("indexes the canonical catalog root", async () => {
    expect((await buildServerCatalogMetadata({})).robots).toEqual({ index: true, follow: true })
  })

  it("never indexes faceted catalog variants", () => {
    const metadata = buildCatalogMetadata({ category: "women", size: "M" })
    expect(metadata.robots).toEqual({ index: false, follow: true })
  })
})
