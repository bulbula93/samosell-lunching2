// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const calls = vi.hoisted(() => ({ cookieClient: 0, publicClient: 0 }))

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    calls.cookieClient += 1
    const chain: Record<string, unknown> = {}
    for (const method of ["select", "eq", "is", "not", "in", "order", "limit"]) {
      chain[method] = () => chain
    }
    chain.maybeSingle = async () => ({ data: null, error: null })
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], count: 0, error: null })
    return {
      from: () => chain,
      auth: { getUser: async () => ({ data: { user: null } }) },
    }
  },
}))

vi.mock("@/lib/supabase/public-server", () => ({
  createPublicServerClient: () => {
    calls.publicClient += 1
    const chain: Record<string, unknown> = {}
    for (const method of ["select", "eq", "order"]) chain[method] = () => chain
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null })
    return { from: () => chain }
  },
}))

import SiteHeader from "@/components/layout/SiteHeader"

describe("public header stays cacheable", () => {
  beforeEach(() => {
    calls.cookieClient = 0
    calls.publicClient = 0
  })

  it("does not touch the session cookie when the caller supplies no viewer", async () => {
    // Reading cookies here is what forced every public page that renders the
    // header to be rendered per request instead of served from the CDN.
    const element = await SiteHeader()
    expect(element).toBeTruthy()
    expect(calls.cookieClient).toBe(0)
    expect(calls.publicClient).toBe(1)
  })

  it("keeps the server-rendered path for routes that already know the viewer", async () => {
    await SiteHeader({ authenticatedUser: { id: "11111111-1111-4111-8111-111111111111" } })
    expect(calls.cookieClient).toBe(1)
  })

  it("renders the guest header without a session read when the route knows nobody is signed in", async () => {
    const element = await SiteHeader({ authenticatedUser: null })
    expect(element).toBeTruthy()
    expect(calls.cookieClient).toBe(0)
  })
})
