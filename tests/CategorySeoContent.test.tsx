import { render, screen } from "@testing-library/react"
import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import CategorySeoContent from "@/components/listings/CategorySeoContent"
import { INDEXABLE_CATALOG_CATEGORIES, isCatalogCategory } from "@/lib/catalog-urls"
import { CATEGORY_SEO } from "@/lib/seo"

const entries = Object.entries(CATEGORY_SEO)

describe("category SEO content", () => {
  it("every indexable category has a guide with sections, FAQs and related links", () => {
    for (const { value } of INDEXABLE_CATALOG_CATEGORIES) {
      const g = CATEGORY_SEO[value].guide
      expect(g.sections.length).toBeGreaterThanOrEqual(2)
      expect(g.faqs.length).toBeGreaterThanOrEqual(3)
      expect(g.related.length).toBeGreaterThanOrEqual(3)
    }
  })

  it("titles fit Google's ~60 char snippet together with the ' | SamoSell' suffix budget", () => {
    for (const [, seo] of entries) expect(seo.title.length + " | SamoSell".length).toBeLessThanOrEqual(70)
  })

  it("guide text is unique across categories (no duplicate content)", () => {
    const texts = entries.flatMap(([, s]) => s.guide.sections.map(x => x.text))
    expect(new Set(texts).size).toBe(texts.length)
  })

  it("related links point to existing routes and never to the category itself", () => {
    for (const [key, seo] of entries) {
      for (const link of seo.guide.related) {
        expect(link.href).not.toBe(`/catalog/${key}`)
        const cat = link.href.match(/^\/catalog\/([^/?]+)$/)?.[1]
        if (cat) expect(isCatalogCategory(cat)).toBe(true)
        else expect(existsSync(`app${link.href}/page.tsx`), link.href).toBe(true)
      }
    }
  })

  it("renders headings, FAQ and crawlable links without client JavaScript", () => {
    render(<CategorySeoContent seo={CATEGORY_SEO.perfume} />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("სუნამოები და პარფიუმერია")
    expect(screen.getByText(CATEGORY_SEO.perfume.guide.faqs[0].question)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "აქსესუარები" })).toHaveAttribute("href", "/catalog/accessories")
    expect(screen.queryAllByRole("heading", { level: 1 })).toHaveLength(0)
  })
})
