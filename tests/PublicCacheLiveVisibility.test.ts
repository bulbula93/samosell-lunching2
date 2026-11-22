import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeListing } from "@/tests/fixtures"

const state = vi.hoisted(() => ({ live: {} as Record<string, unknown>, cached: vi.fn(), client: vi.fn() }))
vi.mock("@/lib/public-marketplace-cache", () => ({ getCachedPublicRows: state.cached }))
vi.mock("@/lib/supabase/server", () => ({ createClient: state.client }))
import { fetchListingPageData, generateListingMetadata } from "@/lib/listing-page"

beforeEach(() => {
  vi.clearAllMocks()
  state.live = makeListing({ price: 120, status: "active" })
  state.cached.mockResolvedValue({ data: makeListing({ price: 50, status: "active" }), error: null })
  state.client.mockImplementation(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: state.live, error: null }) }; return query },
  }))
})

describe("cached listing authorization and live price", () => {
  it("uses the live price instead of a stale cached price in metadata", async () => {
    const metadata = await generateListingMetadata("linen-jacket")
    expect(metadata?.title).toContain("120")
    expect(metadata?.title).not.toContain("50")
    expect(state.cached).toHaveBeenCalledOnce()
  })
  it.each(["reserved", "sold", "draft", "archived"])("does not expose a cached active listing to a guest after status becomes %s", async (status) => {
    state.live = { ...state.live, status }
    await expect(fetchListingPageData("linen-jacket")).resolves.toBeNull()
    expect(state.cached).not.toHaveBeenCalled()
  })
  it("does not serve a cached listing after live visibility disappears", async () => {
    state.client.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) }, from: () => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) }; return query
    } })
    await expect(fetchListingPageData("linen-jacket")).resolves.toBeNull()
    expect(state.cached).not.toHaveBeenCalled()
  })
  it("provides canonical public Open Graph and Twitter cards without Preview URLs", async () => {
    state.cached.mockResolvedValue({ data: makeListing({ slug: "linen-jacket", cover_image_url: null, size_label: "M", city: "თბილისი" }), error: null })
    const metadata = await generateListingMetadata("linen-jacket")
    expect(metadata?.alternates?.canonical).toBe("https://samosell.ge/listing/linen-jacket")
    expect(metadata?.openGraph).toMatchObject({
      url: "https://samosell.ge/listing/linen-jacket", siteName: "SamoSell", type: "website",
      images: [{ url: "https://samosell.ge/listing-og-fallback.png" }],
    })
    expect(metadata?.openGraph?.description).toContain("M")
    expect(metadata?.openGraph?.description).toContain("თბილისი")
    expect(metadata?.twitter).toMatchObject({ card: "summary_large_image", images: ["https://samosell.ge/listing-og-fallback.png"] })
  })
})
