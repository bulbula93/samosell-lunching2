// @vitest-environment node
import { existsSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ unstable_cache: (load: unknown) => load }))

const state = vi.hoisted(() => ({
  profile: null as null | {
    id: string
    username: string
    full_name: string | null
    bio: string | null
    is_suspended: boolean
  },
}))

// generateMetadata must never take this path: constructing the cookie client is
// what made the metadata dynamic and turned the 404 into a 200 soft 404.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    throw new Error("seller metadata must not read cookies")
  },
}))

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: state.profile
              ? { id: state.profile.id, is_suspended: state.profile.is_suspended }
              : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}))

vi.mock("@/lib/public-seller-data", () => ({
  getCachedPublicSellerData: async () => ({
    profile: state.profile ? { ...state.profile } : null,
    listings: [],
    sellerCounts: { active_count: 0, sold_count: 0 },
    sellerReviewData: { summary: { reviewCount: 0, averageScore: null }, reviews: [] },
  }),
}))

import { generateMetadata } from "@/app/seller/[username]/page"

function params(username: string) {
  return { params: Promise.resolve({ username }) }
}

describe("public seller profile metadata", () => {
  beforeEach(() => {
    state.profile = null
  })

  it("ships a segment not-found boundary so the 404 status survives", () => {
    // Without this file the thrown notFound() renders the root boundary and the
    // response keeps a 200 status, which is the soft 404 this change fixes.
    expect(existsSync(join(process.cwd(), "app/seller/[username]/not-found.tsx"))).toBe(true)
  })

  it("404s an unknown seller instead of answering 200 with a soft-404 page", async () => {
    // notFound() rejects from generateMetadata, which happens before the
    // response streams, so the request resolves as a real 404.
    await expect(generateMetadata(params("nobody-here"))).rejects.toThrow()
  })

  it("404s a suspended seller", async () => {
    state.profile = {
      id: "11111111-1111-4111-8111-111111111111",
      username: "suspended-seller",
      full_name: "Suspended Seller",
      bio: null,
      is_suspended: true,
    }
    await expect(generateMetadata(params("suspended-seller"))).rejects.toThrow()
  })

  it("does not repeat the SamoSell brand inside the title", async () => {
    state.profile = {
      id: "11111111-1111-4111-8111-111111111111",
      username: "Dnnd",
      full_name: "დკ",
      bio: null,
      is_suspended: false,
    }

    const metadata = await generateMetadata(params("Dnnd"))

    // The root layout template already appends "| SamoSell".
    expect(metadata.title).toBe("დკ — გამყიდველის პროფილი")
    expect(String(metadata.title)).not.toContain("SamoSell")
    expect(metadata.alternates?.canonical).toBe("/seller/Dnnd")
  })

  it("prefers the username when the seller has no display name", async () => {
    state.profile = {
      id: "11111111-1111-4111-8111-111111111111",
      username: "user_d4128cc7",
      full_name: null,
      bio: null,
      is_suspended: false,
    }

    const metadata = await generateMetadata(params("user_d4128cc7"))

    expect(metadata.title).toBe("user_d4128cc7 — გამყიდველის პროფილი")
  })
})
