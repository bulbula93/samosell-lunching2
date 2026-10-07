import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  buildSeoGuideMetadata,
  buildSeoGuideStructuredData,
  SEO_GUIDES,
} from "@/lib/seo-guides"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("SEO guide landing pages", () => {
  const guides = Object.values(SEO_GUIDES)

  it("defines four distinct indexable evergreen landing pages", () => {
    expect(guides).toHaveLength(4)
    expect(new Set(guides.map((guide) => guide.path)).size).toBe(4)
    expect(new Set(guides.map((guide) => guide.title)).size).toBe(4)
    expect(new Set(guides.map((guide) => guide.description)).size).toBe(4)

    for (const guide of guides) {
      const metadata = buildSeoGuideMetadata(guide)
      expect(metadata.alternates?.canonical).toBe("https://samosell.ge" + guide.path)
      expect(metadata.robots).toEqual({ index: true, follow: true })
      expect(guide.description.length).toBeGreaterThan(90)
      expect(guide.faqs.length).toBeGreaterThanOrEqual(4)
    }
  })

  it("emits WebPage, breadcrumb and FAQ structured data without fake ratings", () => {
    for (const guide of guides) {
      const json = buildSeoGuideStructuredData(guide)
      const serialized = JSON.stringify(json)
      expect(serialized).toContain('"@type":"WebPage"')
      expect(serialized).toContain('"@type":"BreadcrumbList"')
      expect(serialized).toContain('"@type":"FAQPage"')
      expect(serialized).not.toContain("AggregateRating")
      expect(serialized).not.toContain("Review")
    }
  })

  it("keeps all four guides discoverable through sitemap and internal links", () => {
    const sitemap = read("app/sitemap.ts")
    const footer = read("components/layout/SiteFooter.tsx")
    const sell = read("app/sell-fast/page.tsx")
    const safety = read("app/safety/page.tsx")

    for (const guide of guides) {
      expect(sitemap).toContain(guide.path)
    }

    expect(footer).toContain("/vintage-georgia")
    expect(footer).toContain("/sustainable-fashion")
    expect(sell).toContain("SEO_GUIDES.sellFast")
    expect(safety).toContain("SEO_GUIDES.safety")
  })
})
