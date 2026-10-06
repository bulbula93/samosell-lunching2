// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase/proxy", () => ({ updateSession: vi.fn(() => new Response(null, { status: 200 })) }))
vi.mock("@/app/catalog/catalog-view", () => ({ default: () => null }))
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404") }) }))

import { proxy } from "@/proxy"
import CategoryPage, { generateMetadata } from "@/app/catalog/[category]/page"
import { INDEXABLE_CATALOG_CATEGORIES } from "@/lib/catalog-urls"

describe("category route HTTP behavior", () => {
  it.each(INDEXABLE_CATALOG_CATEGORIES)("returns an actual 308 for old $value queries", async ({ value }) => {
    const response = await proxy(new NextRequest(`https://samosell.ge/catalog?category=${value}&size=M&brand=Zara`))
    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(`https://samosell.ge/catalog/${value}?size=M&brand=Zara`)
  })

  it.each(["not-a-real-category", "Women", "women/extra"])("returns HTTP 404 before streaming for %s", async (category) => {
    const response = await proxy(new NextRequest(`https://samosell.ge/catalog/${category}`))
    expect(response.status).toBe(404)
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://samosell.ge/catalog-not-found")
  })

  it("calls notFound for invalid page and metadata params", async () => {
    const props = { params: Promise.resolve({ category: "not-a-real-category" }) }
    await expect(CategoryPage(props)).rejects.toThrow("404")
    await expect(generateMetadata(props)).rejects.toThrow("404")
  })

  it("injects the route category into shared catalog filters and metadata", async () => {
    const props = { params: Promise.resolve({ category: "perfume" }), searchParams: Promise.resolve({ brand: "Dior", page: "2" }) }
    const page = await CategoryPage(props)
    expect(page.props.params).toEqual({ category: "perfume", brand: "Dior", page: "2" })
    expect(await generateMetadata(props)).toMatchObject({ robots: { index: false, follow: true }, alternates: { canonical: "https://samosell.ge/catalog/perfume" } })
  })

  it("noindexes ambiguous repeated category parameters on a clean route", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ category: "women" }), searchParams: Promise.resolve({ category: ["men", "kids"] }) })
    expect(meta.robots).toEqual({ index: false, follow: true })
  })
})
