// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
const session = vi.hoisted(() => vi.fn(() => NextResponse.next()))
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: session }))
import { proxy } from "@/proxy"

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true")
  vi.stubEnv("VERCEL_ENV", "preview")
  session.mockClear()
})
afterEach(() => vi.unstubAllEnvs())

describe("Read-only preview static font access", () => {
  it.each(["400", "500", "600", "700", "800"])("allows GET/HEAD for shipped FiraGO %s without touching Supabase", async weight => {
    for (const method of ["GET", "HEAD"]) {
      expect((await proxy(new NextRequest(`https://preview.example/fonts/firago-${weight}.woff2`, { method }))).status).toBe(200)
    }
    expect(session).not.toHaveBeenCalled()
  })
  it.each([
    ["/fonts/firago-400.woff2", "POST"],
    ["/fonts/private.woff2", "GET"],
    ["/api/private.woff2", "GET"],
    ["/api/payments/flitt/callback", "POST"],
    ["/api/home-personalization", "GET"],
    ["/dashboard/listings", "GET"],
    ["/login", "GET"],
  ])("continues to deny %s %s", async (pathname, method) => {
    const result = await proxy(new NextRequest(`https://preview.example${pathname}`, { method }))
    expect(result.status).toBe(403)
    expect(await result.json()).toEqual({ error: "preview_read_only" })
    expect(session).not.toHaveBeenCalled()
  })
  it("does not apply the preview rule to production", async () => {
    vi.stubEnv("VERCEL_ENV", "production")
    await proxy(new NextRequest("https://samosell.ge/fonts/firago-400.woff2"))
    expect(session).toHaveBeenCalledOnce()
  })
})
