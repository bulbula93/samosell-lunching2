import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Catalog timeout resilience", () => {
  const source = readFileSync("app/catalog/catalog-view.tsx", "utf8")
  it("degrades optional facets without crashing the catalog", () => {
    expect(source).toContain("getCachedCatalogFilterOptions().catch((error)")
    expect(source).toContain("return { sizes: [], colors: [], cities: [] }")
  })
  it("shows an explicit retry state when the main listing query fails", () => {
    expect(source).toContain('role="alert"')
    expect(source).toContain("განცხადებები დროებით ვერ ჩაიტვირთა")
    expect(source).toContain('href={currentPath}')
    expect(source).toContain("queryError ? (")
    expect(source).not.toContain('throw new Error("catalog_data_failed")')
  })
  it("does not claim zero listings or emit search analytics during an outage", () => {
    expect(source).toContain("!queryError ? <CatalogPageHeader")
    expect(source).toContain("if (searchId && !queryError)")
    expect(source).toContain("!queryError && catalogSeo.indexable")
  })
  it("does not treat favorites outages as full catalog outages", () => {
    expect(source).toContain("const queryError = rankedSearchResponse.error || listingsResponse.error")
    expect(source).toContain("catalog_favorites_unavailable")
  })
})
