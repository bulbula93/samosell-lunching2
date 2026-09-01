import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildCatalogCanonicalPath,
  buildHomeStructuredData,
  buildListingStructuredData,
  GOOGLE_SITE_VERIFICATION,
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

  it("consolidates faceted and custom-sorted catalog URLs", () => {
    expect(
      buildCatalogCanonicalPath({ page: 1, hasFilters: false, hasCustomSort: false }),
    ).toBe("/catalog")
    expect(
      buildCatalogCanonicalPath({ page: 3, hasFilters: false, hasCustomSort: false }),
    ).toBe("/catalog?page=3")
    expect(
      buildCatalogCanonicalPath({ page: 3, hasFilters: true, hasCustomSort: false }),
    ).toBe("/catalog")
    expect(
      buildCatalogCanonicalPath({ page: 1, hasFilters: false, hasCustomSort: true }),
    ).toBe("/catalog")
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
  })
})
