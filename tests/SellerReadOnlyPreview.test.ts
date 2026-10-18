// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const requests = vi.hoisted(() => [] as Array<{ path: string; method: string }>)
vi.mock("@/lib/supabase/server", async () => {
  const { createClient } = await import("@supabase/supabase-js")
  const { previewFetchOptions } = await import("@/lib/preview-read-only")
  return { createClient: async () => {
    const client = createClient("https://example.supabase.co", "public-test-key", {
      ...previewFetchOptions(), auth: { persistSession: false, autoRefreshToken: false },
    })
    return { from: client.from.bind(client), rpc: client.rpc.bind(client),
      auth: { getUser: async () => ({ data: { user: null } }) } }
  } }
})
vi.mock("@/lib/reviews", () => ({ fetchSellerReviewData: async () => ({
  summary: { reviewCount: 0, averageScore: null }, reviews: [],
}) }))
vi.mock("@/lib/story-data", () => ({
  getFollowSummary: async () => ({ followers: 0, following: 0, isFollowing: false }),
  hasActiveStory: async () => false,
}))
import SellerPage from "@/app/seller/[username]/page"

beforeEach(() => {
  requests.length = 0
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null
    const url = new URL(request?.url ?? String(input))
    requests.push({ path: url.pathname, method: init?.method ?? request?.method ?? "GET" })
    const data = url.pathname.endsWith("/profiles")
      ? [{ id: "11111111-1111-4111-8111-111111111111", username: "seller", full_name: "Seller", seller_type: "individual", created_at: "2026-01-01T00:00:00Z" }]
      : url.pathname.endsWith("/get_public_seller_listing_counts")
        ? [{ active_count: 1, sold_count: 0 }]
        : []
    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } })
  }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("seller page public read transport", () => {
  it("renders through the real SDK and read-only guard using only GET requests", async () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true")
    await expect(SellerPage({ params: Promise.resolve({ username: "seller" }) })).resolves.toBeTruthy()
    expect(requests.find((request) => request.path.endsWith("/get_public_seller_listing_counts"))?.method).toBe("GET")
    expect(requests.every((request) => request.method === "GET")).toBe(true)
  })

  it("preserves the existing POST RPC in Production even if the Preview flag is present", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true")
    await expect(SellerPage({ params: Promise.resolve({ username: "seller" }) })).resolves.toBeTruthy()
    expect(requests.find((request) => request.path.endsWith("/get_public_seller_listing_counts"))?.method).toBe("POST")
  })
})
