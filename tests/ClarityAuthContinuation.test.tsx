import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(), signUp: vi.fn(), signInWithOAuth: vi.fn(),
  getUser: vi.fn(), exchangeCodeForSession: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: (path: string) => { throw new Error(`REDIRECT:${path}`) },
}))
import LoginForm from "@/components/auth/LoginForm"
import ForgotPasswordPage from "@/app/forgot-password/page"
import RegisterForm from "@/components/auth/RegisterForm"
import SocialAuthButtons from "@/components/auth/SocialAuthButtons"

const destination = "/dashboard/listings/new"
beforeEach(() => {
  vi.resetAllMocks()
  auth.resetPasswordForEmail.mockResolvedValue({ error: null })
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
})

describe("Clarity auth continuation regression", () => {
  it("keeps the listing destination when opening password recovery", () => {
    render(<LoginForm nextPath={destination} />)
    const link = screen.getByRole("link", { name: "პაროლი დაგავიწყდა?" })
    expect(new URL(link.getAttribute("href")!, "http://localhost").searchParams.get("next")).toBe(destination)
  })

  it("keeps password recovery reachable in the keyboard tab order", async () => {
    const user = userEvent.setup()
    render(<LoginForm nextPath={destination} />)
    screen.getByLabelText("Email").focus()
    await user.tab()
    expect(screen.getByRole("link", { name: "პაროლი დაგავიწყდა?" })).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText("Password")).toHaveFocus()
  })

  it("keeps the destination when returning to login, and in the recovery callback", async () => {
    render(await ForgotPasswordPage({ searchParams: Promise.resolve({ next: destination }) }))
    const back = screen.getByRole("link", { name: "შესვლა" })
    expect(new URL(back.getAttribute("href")!, "http://localhost").searchParams.get("next")).toBe(destination)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Email"), "qa@example.test")
    await user.click(screen.getByRole("button", { name: "აღდგენის ბმულის გაგზავნა" }))
    const callback = new URL(auth.resetPasswordForEmail.mock.calls[0][1].redirectTo)
    const reset = new URL(callback.searchParams.get("next")!, "http://localhost")
    expect(reset.pathname).toBe("/reset-password")
    expect(reset.searchParams.get("next")).toBe(destination)
    expect(screen.getByRole("status")).toHaveTextContent("თუ ამ ელფოსტით ანგარიში არსებობს")
  })

  it.each(["//evil.example", "https://evil.example", "/\\evil.example"])("rejects an external recovery return path: %s", async (next) => {
    render(await ForgotPasswordPage({ searchParams: Promise.resolve({ next }) }))
    const back = new URL(screen.getByRole("link", { name: "შესვლა" }).getAttribute("href")!, "http://localhost")
    expect(back.origin).toBe("http://localhost")
    expect(back.searchParams.get("next") ?? "/").toBe("/")
  })
})

describe("auth feedback accessibility regression", () => {
  it("announces registration errors and leaves the form available for retry", async () => {
    auth.signUp.mockResolvedValue({ error: { message: "QA registration error" } })
    const user = userEvent.setup()
    render(<RegisterForm nextPath={destination} />)
    await user.type(screen.getByLabelText("Email"), "qa@example.test")
    await user.type(screen.getByLabelText("Password"), "qa-password")
    await user.click(screen.getByRole("button", { name: "რეგისტრაცია" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("QA registration error")
    expect(screen.getByRole("button", { name: "რეგისტრაცია" })).toBeEnabled()
  })

  it("announces email confirmation instructions after registration", async () => {
    const user = userEvent.setup()
    render(<RegisterForm nextPath={destination} />)
    await user.type(screen.getByLabelText("Email"), "qa@example.test")
    await user.type(screen.getByLabelText("Password"), "qa-password")
    await user.click(screen.getByRole("button", { name: "რეგისტრაცია" }))
    expect(await screen.findByRole("status")).toHaveTextContent("გადაამოწმე ელფოსტა")
  })

  it("announces Google OAuth errors", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: { message: "QA OAuth error" } })
    render(<SocialAuthButtons mode="login" nextPath={destination} />)
    await userEvent.click(screen.getByRole("button", { name: /Google/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("QA OAuth error")
    expect(screen.getByRole("button", { name: /Google/ })).toBeEnabled()
  })
})
