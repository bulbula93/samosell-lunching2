// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
import { orderPosted } from "@/lib/social/link-in-bio"

const row = (id: string, over: Record<string, unknown> = {}) => ({ id, slug: `s-${id}`, title: `T ${id}`, price: 10, currency: "GEL", sale_type: "sell", cover_image_url: `https://x/${id}.webp`, status: "active", ...over })

describe("link-in-bio ordering", () => {
  it("keeps newest-posted order, drops inactive / incomplete listings and duplicates", () => {
    const out = orderPosted(["b", "a", "b", "gone", "sold", "noimg"], [row("a"), row("b"), row("sold", { status: "sold" }), row("noimg", { cover_image_url: null })])
    expect(out.map(x => x.id)).toEqual(["b", "a"])
    expect(out[0]).toMatchObject({ slug: "s-b", price: 10, currency: "GEL", image: "https://x/b.webp" })
  })
})
