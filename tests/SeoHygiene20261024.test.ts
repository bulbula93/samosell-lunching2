// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import nextConfig from "../next.config"
import sitemap from "@/app/sitemap"
import { buildCatalogDescription, buildHomeStructuredData, getSiteUrl } from "@/lib/seo"

vi.mock("next/cache", () => ({ unstable_cache: (load: unknown) => load }))

type SecurityHeaders = Array<{
  source: string
  headers: Array<{ key: string; value: string }>
}>

describe("baseline response hardening", () => {
  it("sends the security headers on every route", async () => {
    const config = nextConfig as unknown as {
      poweredByHeader?: boolean
      headers?: () => Promise<SecurityHeaders>
    }
    expect(config.poweredByHeader).toBe(false)
    expect(typeof config.headers).toBe("function")

    const groups = await config.headers!()
    const all = groups.find((group) => group.source === "/:path*")
    expect(all).toBeTruthy()

    const byKey = new Map(all!.headers.map((header) => [header.key, header.value]))
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff")
    expect(byKey.get("X-Frame-Options")).toBe("SAMEORIGIN")
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    // Payment and camera features must stay available to the app itself.
    expect(byKey.get("Permissions-Policy")).not.toContain("payment=")
    expect(byKey.get("Permissions-Policy")).not.toContain("fullscreen=")
  })
})

describe("catalog metadata language", () => {
  it("describes the catalog in Georgian", () => {
    const description = buildCatalogDescription()
    expect(description).toContain("SamoSell")
    // Georgian script must dominate; an English sentence here competed with the
    // Georgian category pages in search result snippets.
    expect(/[\u10A0-\u10FF]/.test(description)).toBe(true)
    expect(description).not.toMatch(/[A-Za-z]{4,}\s+[A-Za-z]{4,}\s+[A-Za-z]{4,}/)
  })

  it("appends the active filters without losing the Georgian base", () => {
    const description = buildCatalogDescription(["ზომა M", "ფასი 20–50 ₾"])
    expect(description).toContain("აქტიური ფილტრები")
    expect(description).toContain("ზომა M")
  })
})

describe("website structured data", () => {
  it("declares the internal catalog search as a SearchAction", () => {
    const data = buildHomeStructuredData() as {
      "@graph": Array<Record<string, unknown>>
    }
    const website = data["@graph"].find((node) => node["@type"] === "WebSite")
    expect(website).toBeTruthy()

    const action = website!.potentialAction as {
      "@type": string
      target: { "@type": string; urlTemplate: string }
      "query-input": string
    }
    expect(action["@type"]).toBe("SearchAction")
    expect(action.target.urlTemplate).toBe(
      `${getSiteUrl()}/catalog?q={search_term_string}`,
    )
    expect(action["query-input"]).toBe("required name=search_term_string")
  })
})

describe("sitemap commercial entry points", () => {
  it("lists the sell, stores and for-stores routes", async () => {
    const urls = (await sitemap()).map((entry) => entry.url)
    const siteUrl = getSiteUrl()
    expect(urls).toContain(`${siteUrl}/sell`)
    expect(urls).toContain(`${siteUrl}/stores`)
    expect(urls).toContain(`${siteUrl}/for-stores`)
  })

  it("keeps private routes out of the sitemap", async () => {
    const urls = (await sitemap()).map((entry) => entry.url)
    for (const privateRoute of ["/dashboard", "/admin", "/login", "/api"]) {
      expect(urls.some((url) => url.includes(`/samosell.ge${privateRoute}`))).toBe(false)
    }
  })
})
