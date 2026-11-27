import { readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const verifyOtp = vi.fn()
const exchangeCodeForSession = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp, exchangeCodeForSession } }),
}))
vi.mock("@/lib/env", () => ({ getSiteUrlEnv: () => "https://samosell.ge" }))

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("email confirmation works across browsers", () => {
  beforeEach(() => {
    verifyOtp.mockReset()
    exchangeCodeForSession.mockReset()
  })

  it("verifies signup token_hash links without a PKCE verifier", async () => {
    verifyOtp.mockResolvedValue({ error: null })
    const { GET } = await import("@/app/auth/confirm/route")
    const res = await GET(new Request("https://samosell.ge/auth/confirm?token_hash=abc&type=email&next=%2Fdashboard%2Flistings%2Fnew"))
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" })
    expect(res.headers.get("location")).toBe("https://samosell.ge/dashboard/listings/new")
  })

  it("sends recovery token_hash links to the reset page", async () => {
    verifyOtp.mockResolvedValue({ error: null })
    const { GET } = await import("@/app/auth/confirm/route")
    const res = await GET(new Request("https://samosell.ge/auth/confirm?token_hash=abc&type=recovery"))
    expect(res.headers.get("location")).toBe("https://samosell.ge/reset-password")
  })

  it("routes failed recovery links back to a fresh request and rejects unsafe next paths", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } })
    const { GET } = await import("@/app/auth/confirm/route")
    const failed = await GET(new Request("https://samosell.ge/auth/confirm?token_hash=abc&type=recovery"))
    expect(failed.headers.get("location")).toBe("https://samosell.ge/forgot-password?error=invalid_or_expired")

    verifyOtp.mockResolvedValue({ error: null })
    const unsafe = await GET(new Request("https://samosell.ge/auth/confirm?token_hash=abc&type=email&next=%2F%2Fevil.com"))
    expect(unsafe.headers.get("location")).toBe("https://samosell.ge/")
  })

  it("ignores unknown otp types", async () => {
    const { GET } = await import("@/app/auth/confirm/route")
    const res = await GET(new Request("https://samosell.ge/auth/confirm?token_hash=abc&type=bogus"))
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(res.headers.get("location")).toContain("/login?error=email_link_invalid")
  })

  it("tells confirmed email signups to log in when the PKCE exchange fails in another browser", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "code verifier missing" } })
    const { GET } = await import("@/app/auth/callback/route")
    const res = await GET(new Request("https://samosell.ge/auth/callback?code=xyz&next=%2F&flow=email_signup"))
    expect(res.headers.get("location")).toContain("/login?error=email_confirmed_login")
  })

  it("keeps the social-login error for OAuth callbacks", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: "bad" } })
    const { GET } = await import("@/app/auth/callback/route")
    const res = await GET(new Request("https://samosell.ge/auth/callback?code=xyz&next=%2F"))
    expect(res.headers.get("location")).toContain("/login?error=oauth_callback_failed")
  })

  it("marks signup redirects and shows Georgian messages on login", () => {
    expect(read("components/auth/RegisterForm.tsx")).toContain("&flow=email_signup")
    const login = read("app/login/page.tsx")
    expect(login).toContain('authError === "email_confirmed_login"')
    expect(login).toContain("ელფოსტა დადასტურებულია")
    expect(read("proxy.ts")).toContain('pathname === "/auth/confirm" && searchParams.has("token_hash")')
  })
})
