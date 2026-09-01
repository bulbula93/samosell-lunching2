import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildCatalogCanonicalPath,
  buildHomeStructuredData,
  buildListingStructuredData,
  GOOGLE_SITE_VERIFICATION,
  INDEXABLE_CATALOG_CATEGORIES,
  serializeJsonLd,
} from "@/lib/seo"
import { makeListing } from "@/tests/fixtures"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("Google discovery metadata", () => {
  it("keeps a stable public Search Console verification token", () => {
    expect(GOOGLE_SITE_VERIFICATION).toBe(
      "uQuez09mPR--nX75FjQfxC1lHoSPZ4Kp19VP2rdNhf0",
    )
    expect(read("app/layout.tsx")).toContain("google: GOOGLE_SITE_VERIFICATION")
  })

  it("indexes clean catalog/category pages and consolidates faceted URLs", () => {
    expect(
      buildCatalogCanonicalPath({ page: 1, hasOtherFilters: false, hasSortParameter: false, hasTransientState: false }),
    ).toEqual({ canonicalPath: "/catalog", indexable: true, categoryLabel: "" })
    expect(
      buildCatalogCanonicalPath({ page: 3, category: "women", hasOtherFilters: false, hasSortParameter: false, hasTransientState: false }),
    ).toEqual({ canonicalPath: "/catalog?category=women&page=3", indexable: true, categoryLabel: "ქალებისთვის" })
    expect(
      buildCatalogCanonicalPath({ page: 3, category: "women", hasOtherFilters: true, hasSortParameter: false, hasTransientState: false }),
    ).toEqual({ canonicalPath: "/catalog?category=women", indexable: false, categoryLabel: "ქალებისთვის" })
    expect(
      buildCatalogCanonicalPath({ page: 1, hasOtherFilters: false, hasSortParameter: true, hasTransientState: false }),
    ).toEqual({ canonicalPath: "/catalog", indexable: false, categoryLabel: "" })
    expect(
      buildCatalogCanonicalPath({ page: 1, category: "not-real", hasOtherFilters: false, hasSortParameter: false, hasTransientState: false }),
    ).toEqual({ canonicalPath: "/catalog", indexable: false, categoryLabel: "" })
    expect(INDEXABLE_CATALOG_CATEGORIES.map((item) => item.value)).toContain("vintage")
  })

  it("builds honest server-rendered website and product data", () => {
    const homeData = buildHomeStructuredData()
    expect(homeData["@graph"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ "@type": "Organization", name: "SamoSell" }),
        expect.objectContaining({ "@type": "WebSite", inLanguage: "ka-GE" }),
      ]),
    )

    const listing = makeListing({
      id: "listing-seo",
      title: "Prada ვინტაჟური ქურთუკი",
      description: "კარგ მდგომარეობაში შენახული ვინტაჟური ქურთუკი",
      price: 249.9,
      cover_image_url: "https://images.example/item.webp",
      color: "შავი",
      material: "მატყლი",
    })
    const listingData = buildListingStructuredData(listing)
    const product = listingData["@graph"][0]

    expect(product).toMatchObject({
      "@type": "Product",
      name: listing.title,
      image: [listing.cover_image_url],
      itemCondition: "https://schema.org/UsedCondition",
      offers: {
        "@type": "Offer",
        price: "249.90",
        priceCurrency: "GEL",
        availability: "https://schema.org/InStock",
      },
    })
    expect(JSON.stringify(listingData)).not.toContain("checkout")
    expect(JSON.stringify(listingData)).not.toContain("shipping")
  })

  it("escapes user-controlled JSON-LD text before HTML insertion", () => {
    const serialized = serializeJsonLd({
      name: "</script><script>alert('xss')</script>&",
    })

    expect(serialized).not.toContain("<")
    expect(serialized).not.toContain(">")
    expect(serialized).not.toContain("&")
    expect(serialized).toContain("\\u003c/script\\u003e")
  })

  it("keeps private auth routes out of search and public sellers in the sitemap", () => {
    expect(read("app/login/page.tsx")).toContain(
      "robots: { index: false, follow: false }",
    )
    expect(read("app/register/page.tsx")).toContain(
      "robots: { index: false, follow: false }",
    )
    const sitemap = read("app/sitemap.ts")
    expect(sitemap).toContain('seller_username')
    expect(sitemap).toContain('/seller/${encodeURIComponent(username)}')
    expect(sitemap).toContain("INDEXABLE_CATALOG_CATEGORIES")
    expect(sitemap).toContain('select("slug, updated_at")')
    expect(read("app/listing/[slug]/page.tsx")).toContain(
      "if (!metadata) notFound()",
    )
    expect(read("app/listing/[slug]/layout.tsx")).toContain(
      "if (!metadata) notFound()",
    )
  })
})
