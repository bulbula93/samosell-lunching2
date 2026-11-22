import { createElement } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({
  getUser: vi.fn(), exchangeCodeForSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  signInWithPassword: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }))
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) } }))
import { GET } from "@/app/auth/callback/route"
import ResetPasswordPage from "@/app/reset-password/page"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import LoginForm from "@/components/auth/LoginForm"
import { getAuthPagePath } from "@/lib/auth-redirect"

const destination = "/dashboard/listings/new?source=sell&step=photos"
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3210")
  vi.stubEnv("VERCEL_ENV", "preview")
  auth.getUser.mockResolvedValue({ data: { user: null } })
  auth.exchangeCodeForSession.mockResolvedValue({ error: null })
  auth.updateUser.mockResolvedValue({ error: null })
  auth.signOut.mockResolvedValue({ error: null })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

function callback(next: string, code = "qa-code") {
  const request = new URL("http://localhost:3210/auth/callback")
  request.searchParams.set("code", code)
  request.searchParams.set("next", next)
  return GET(new Request(request))
}

describe("password recovery auth flow", () => {
  it("shows a Georgian retry message for invalid credentials", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } })
    const user = userEvent.setup()
    render(createElement(LoginForm))
    await user.type(screen.getByLabelText("Email"), "qa@example.test")
    await user.type(screen.getByLabelText("Password"), "qa-password")
    await user.click(screen.getByRole("button", { name: "შედი" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("ელფოსტა ან პაროლი არასწორია")
    expect(screen.getByRole("button", { name: "შედი" })).toBeEnabled()
  })

  it.each(["/reset-password", getAuthPagePath("/reset-password", destination)])("exchanges a recovery code and keeps the destination: %s", async (next) => {
    const response = await callback(next)
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("qa-code")
    expect(response.headers.get("location")).toBe(new URL(next, "http://localhost:3210").toString())
  })

  it.each(["/reset-password", getAuthPagePath("/reset-password", destination)])("routes expired recovery back to a fresh request: %s", async (next) => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "QA expired code" } })
    const location = new URL((await callback(next)).headers.get("location")!)
    expect(location.pathname).toBe("/forgot-password")
    expect(location.searchParams.get("error")).toBe("invalid_or_expired")
    expect(location.searchParams.get("next") ?? "/").toBe(next === "/reset-password" ? "/" : destination)
  })

  it("does not send a failed Google callback to password recovery", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "QA code failure" } })
    const location = new URL((await callback(destination)).headers.get("location")!)
    expect(location.pathname).toBe("/login")
    expect(location.searchParams.get("next")).toBe(destination)
    expect(location.searchParams.get("error")).toBe("oauth_callback_failed")
  })

  it("rejects external return URLs at the callback boundary", async () => {
    const location = new URL((await callback("//evil.example")).headers.get("location")!)
    expect(location.origin).toBe("http://localhost:3210")
    expect(location.pathname).toBe("/")
  })

  it("requires an authenticated recovery session and preserves the listing destination", async () => {
    await expect(ResetPasswordPage({ searchParams: Promise.resolve({ next: destination }) }))
      .rejects.toThrow(`REDIRECT:${getAuthPagePath("/forgot-password", destination)}&error=invalid_or_expired`)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it("keeps a safe cancel link on the authenticated password reset page", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "qa-user" } } })
    render(await ResetPasswordPage({ searchParams: Promise.resolve({ next: destination }) }))
    expect(screen.getByRole("link", { name: "შესვლაზე დაბრუნება" })).toHaveAttribute("href", getAuthPagePath("/login", destination))
  })

  it("returns to login with the original destination after saving a new password", async () => {
    const user = userEvent.setup()
    const view = render(createElement(ResetPasswordForm, { nextPath: destination }))
    await user.type(screen.getByLabelText("ახალი პაროლი"), "qa-new-password")
    await user.type(screen.getByLabelText("გაიმეორე ახალი პაროლი"), "qa-new-password")
    const replace = vi.fn()
    vi.stubGlobal("window", new Proxy(window, {
      get: (target, property) => property === "location" ? { replace } : Reflect.get(target, property),
    }))
    fireEvent.submit(view.container.querySelector("form")!)
    await waitFor(() => expect(replace).toHaveBeenCalledOnce())
    const login = new URL(replace.mock.calls[0][0], "http://localhost:3210")
    expect(login.pathname).toBe("/login")
    expect(login.searchParams.get("next")).toBe(destination)
    expect(login.searchParams.get("password_reset")).toBe("success")
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "qa-new-password" })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" })
  })
})
