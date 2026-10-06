import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import CatalogPageHeader from "@/components/listings/CatalogPageHeader"
import CatalogPagination from "@/components/listings/CatalogPagination"
import { buildCatalogMetadata } from "@/lib/catalog-seo"
import { getCatalogPath, resolveCatalogState } from "@/lib/catalog-page"
import { INDEXABLE_CATALOG_CATEGORIES, getCatalogRedirectPath, buildCatalogUrl } from "@/lib/catalog-urls"
import { CATEGORY_SEO, buildCatalogStructuredData } from "@/lib/seo"
import { isAdPagePathAllowed } from "@/lib/ads"
import { makeListing } from "@/tests/fixtures"

describe("clean category URLs and SEO", () => {
  it.each(INDEXABLE_CATALOG_CATEGORIES)("indexes $value with a unique absolute canonical and compact H1", ({ value }) => {
    const meta = buildCatalogMetadata({ category: value })
    expect(meta.alternates?.canonical).toBe(`https://samosell.ge/catalog/${value}`)
    expect(meta.robots).toEqual({ index: true, follow: true })
    expect(meta.title).toBe(CATEGORY_SEO[value].title)
    expect(meta.description).toBe(CATEGORY_SEO[value].description)
    render(<CatalogPageHeader totalCount={5} category={value} categorySeo={CATEGORY_SEO[value]} />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(CATEGORY_SEO[value].h1)
  })

  it("has eight distinct titles, descriptions and intro paragraphs", () => {
    for (const key of ["title", "description", "intro"] as const) {
      expect(new Set(Object.values(CATEGORY_SEO).map((seo) => seo[key])).size).toBe(8)
    }
  })

  it.each([{ size: "M" }, { sort: "price_asc" }, { q: "zara" }, { brand: "Zara" }, { vip: "1" }, { sale_type: "gift" }, { unknown: "value" }, { saved_search_status: "saved" }, { page: "02" }, { page: "1" }, { size: ["M", "L"] }])("noindexes faceted, transient and malformed variants %j", (query) => {
    const meta = buildCatalogMetadata({ category: "women", ...query })
    expect(meta.robots).toEqual({ index: false, follow: true })
    expect(meta.alternates?.canonical).toBe("https://samosell.ge/catalog/women")
  })

  it.each(INDEXABLE_CATALOG_CATEGORIES)("permanently migrates $value without losing query data or looping", ({ value }) => {
    const params = new URLSearchParams(`category=${value}&size=M&brand=Zara&color=red&color=blue&page=2&utm_source=test&saved_search_status=saved`)
    const path = getCatalogRedirectPath("/catalog", params)!
    const url = new URL(path, "https://samosell.ge")
    expect(url.pathname).toBe(`/catalog/${value}`)
    expect(url.searchParams.has("category")).toBe(false)
    expect(url.searchParams.getAll("color")).toEqual(["red", "blue"])
    for (const key of ["size", "brand", "page", "utm_source", "saved_search_status"]) {
      expect(url.searchParams.get(key)).toBe(params.get(key))
    }
    expect(getCatalogRedirectPath(url.pathname, url.searchParams)).toBeNull()
  })

  it("normalizes GET category changes and reset without redirecting legacy item filters", () => {
    expect(getCatalogRedirectPath("/catalog/women", new URLSearchParams("category=men&size=L"))).toBe("/catalog/men?size=L")
    expect(getCatalogRedirectPath("/catalog/women", new URLSearchParams("category=&q=nike"))).toBe("/catalog?q=nike")
    expect(getCatalogRedirectPath("/catalog", new URLSearchParams("category=coat"))).toBeNull()
    expect(getCatalogRedirectPath("/catalog", new URLSearchParams("category=women&category=men"))).toBeNull()
    expect(buildCatalogUrl(new URLSearchParams("category=coat&brand=Zara"))).toBe("/catalog?category=coat&brand=Zara")
  })

  it("keeps pagination self-canonical, crawlable and on the category path", () => {
    expect(buildCatalogMetadata({ category: "accessories", page: "2" })).toMatchObject({
      alternates: { canonical: "https://samosell.ge/catalog/accessories?page=2" },
      robots: { index: true, follow: true },
    })
    const { queryParams, currentPath, filters } = resolveCatalogState({ category: "accessories", size: "M", page: "2" })
    expect(filters.category).toBe("accessories")
    expect(currentPath).toBe("/catalog/accessories?size=M&page=2")
    render(<CatalogPagination page={2} totalPages={3} totalItems={65} pageSize={24} pageHref={(page) => getCatalogPath(queryParams, page)} />)
    expect(screen.getByRole("link", { name: "შემდეგი" })).toHaveAttribute("href", "/catalog/accessories?size=M&page=3")
    expect(screen.getByRole("link", { name: "წინა" })).toHaveAttribute("href", "/catalog/accessories?size=M")
  })

  it("uses clean CollectionPage and breadcrumb URLs while preserving listing URLs", () => {
    const data = buildCatalogStructuredData({ canonicalPath: "/catalog/accessories?page=2", categoryLabel: "აქსესუარები", title: "აქსესუარები", description: "აქსესუარების არჩევანი", page: 2, listings: [makeListing({ slug: "test-listing" })] })
    expect(data["@graph"][0]).toMatchObject({ url: "https://samosell.ge/catalog/accessories?page=2" })
    expect(JSON.stringify(data)).toContain("https://samosell.ge/catalog/accessories")
    expect(JSON.stringify(data)).toContain("https://samosell.ge/listing/test-listing")
    expect(JSON.stringify(data)).not.toContain("?category=")
  })

  it("accepts clean category ad placements and rejects unknown paths", () => {
    expect(isAdPagePathAllowed("catalog_top_left", "/catalog/women?size=M")).toBe(true)
    expect(isAdPagePathAllowed("catalog_top_right", "/catalog/perfume")).toBe(true)
    expect(isAdPagePathAllowed("catalog_top_left", "/catalog/not-real")).toBe(false)
  })
})
