// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ create: vi.fn(), claims: vi.fn(), listing: vi.fn(), env: vi.fn() }))
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }))
vi.mock("@/lib/env", () => ({ getPublicEnv: mocks.env }))
import { updateSession } from "@/lib/supabase/proxy"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.env.mockReturnValue({ supabaseUrl: "https://example.supabase.co", supabasePublishableKey: "public-test-key" })
  mocks.claims.mockResolvedValue({ data: { claims: null }, error: null })
  mocks.listing.mockResolvedValue({ data: { id: "listing", status: "active" }, error: null })
  mocks.create.mockImplementation(() => {
    const query = { select: () => query, eq: () => query, abortSignal: () => query, maybeSingle: mocks.listing }
    return { auth: { getClaims: mocks.claims }, from: () => query }
  })
})
afterEach(() => vi.useRealTimers())

describe("Proxy CPU workload and auth boundaries", () => {
  it.each(["/", "/catalog", "/login", "/api/internal/tbc/reconcile", "/api/growth/events"])(
    "does not construct another Supabase SDK for guest %s", async (path) => {
      const response = await updateSession(new NextRequest(`https://example.com${path}`))
      expect(response.headers.get("x-middleware-next")).toBe("1")
      expect(mocks.create).not.toHaveBeenCalled()
      expect(mocks.env).not.toHaveBeenCalled()
    },
  )

  it("still validates a chunked session cookie on the private personalization request", async () => {
    await updateSession(new NextRequest("https://example.com/api/home-personalization", { headers: { cookie: "sb-example-auth-token.0=test" } }))
    expect(mocks.claims).toHaveBeenCalledOnce()
  })

  it.each(["GET", "HEAD"])("keeps a signed-in homepage %s free of session cookies and SDK work", async (method) => {
    const response = await updateSession(new NextRequest("https://example.com/", { method, headers: { cookie: "sb-example-auth-token.0=test" } }))
    expect(mocks.create).not.toHaveBeenCalled()
    expect(response.headers.get("set-cookie")).toBeNull()
  })

  it("keeps session refresh for homepage server actions", async () => {
    await updateSession(new NextRequest("https://example.com/", { method: "POST", headers: { cookie: "sb-example-auth-token.0=test" } }))
    expect(mocks.claims).toHaveBeenCalledOnce()
  })

  it("still redirects a guest dashboard request to login", async () => {
    const response = await updateSession(new NextRequest("https://example.com/dashboard/orders"))
    expect(mocks.claims).toHaveBeenCalledOnce()
    expect(response.headers.get("location")).toBe("https://example.com/login?next=%2Fdashboard%2Forders")
  })

  it("keeps the real 404 guard for a missing listing", async () => {
    mocks.listing.mockResolvedValue({ data: null, error: null })
    const response = await updateSession(new NextRequest("https://example.com/listing/missing-item"))
    expect(response.status).toBe(404)
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://example.com/listing-not-found")
  })

  it("bounds an unresponsive listing guard and defers the error to the route instead of inventing a 404", async () => {
    vi.useFakeTimers()
    mocks.listing.mockImplementation(() => new Promise(() => {}))
    const request = updateSession(new NextRequest("https://example.com/listing/valid-slug"))
    await vi.advanceTimersByTimeAsync(5000)
    const response = await request
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("x-middleware-rewrite")).toBeNull()
  })
})
