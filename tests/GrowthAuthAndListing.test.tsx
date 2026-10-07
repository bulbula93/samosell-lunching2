import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, it, expect, vi } from "vitest"
const auth = vi.hoisted(() => ({ signUp: vi.fn(), oauth: vi.fn(), push: vi.fn(), refresh: vi.fn(), save: vi.fn(), prepare: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signUp: auth.signUp, signInWithOAuth: auth.oauth }, storage: { from: () => ({ uploadToSignedUrl: vi.fn(), getPublicUrl: () => ({ data: { publicUrl: "test" } }) }) } }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: auth.push, refresh: auth.refresh }), usePathname: () => "/dashboard/listings/new", useSearchParams: () => new URLSearchParams() }))
vi.mock("@/app/dashboard/listings/form-actions", () => ({ saveListingAction: auth.save, prepareListingUploadsAction: auth.prepare, abortListingUploadsAction: vi.fn() }))
vi.mock("@/lib/listing-draft", () => ({ readListingDraft: vi.fn(async () => null), saveListingDraft: vi.fn(async () => true), deleteListingDraft: vi.fn(), clearAllListingDrafts: vi.fn() }))
import RegisterForm from "@/components/auth/RegisterForm"
import SocialAuthButtons from "@/components/auth/SocialAuthButtons"
import CreateListingWizard from "@/components/dashboard/CreateListingWizard"
import { saveBrowserConsent } from "@/lib/browser-preferences"
import { clearGrowthStorage } from "@/lib/growth/client"

beforeEach(() => { vi.resetAllMocks(); clearGrowthStorage(); saveBrowserConsent(false, false); auth.signUp.mockResolvedValue({ data: { session: null }, error: null }); auth.oauth.mockResolvedValue({ error: null }); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ conversions: [] }) })) })
describe("Growth auth continuation and seller start", () => {
  it("preserves listing destination in the email confirmation callback and does not count unconfirmed signup", async () => {
    const user = userEvent.setup()
    render(<RegisterForm nextPath="/dashboard/listings/new" />)
    await user.type(screen.getByPlaceholderText("you@example.com"), "seller@example.com")
    await user.type(screen.getByPlaceholderText("მინიმუმ 6 სიმბოლო"), "password123")
    await user.click(screen.getByRole("button", { name: "რეგისტრაცია" }))
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ emailRedirectTo: expect.stringContaining("/auth/callback?next=%2Fdashboard%2Flistings%2Fnew") }) }))
    expect(auth.push).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it("continues the listing flow when email signup returns a confirmed session", async () => {
    auth.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null })
    const user = userEvent.setup(); render(<RegisterForm nextPath="/dashboard/listings/new" />)
    await user.type(screen.getByPlaceholderText("you@example.com"), "seller@example.com")
    await user.type(screen.getByPlaceholderText("მინიმუმ 6 სიმბოლო"), "password123")
    await user.click(screen.getByRole("button", { name: "რეგისტრაცია" }))
    expect(auth.push).toHaveBeenCalledWith("/dashboard/listings/new")
  })
  it("preserves Google OAuth continuation to listing creation", async () => {
    const user = userEvent.setup(); render(<SocialAuthButtons mode="register" nextPath="/dashboard/listings/new" />)
    await user.click(screen.getByRole("button", { name: /Google/ }))
    expect(auth.oauth).toHaveBeenCalledWith(expect.objectContaining({ provider: "google", options: expect.objectContaining({ redirectTo: expect.stringContaining("next=%2Fdashboard%2Flistings%2Fnew") }) }))
  })
  it("blocks external OAuth authorization before a read-only Preview can contact production Auth", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true"); vi.stubEnv("VERCEL_ENV", "preview")
    try {
      const user = userEvent.setup(); render(<SocialAuthButtons mode="login" nextPath="/dashboard/listings/new" />)
      await user.click(screen.getByRole("button", { name: /Google/ }))
      expect(auth.oauth).not.toHaveBeenCalled()
      expect(screen.getByText(/ეს Preview მხოლოდ სანახავადაა/)).toBeVisible()
    } finally { vi.unstubAllEnvs() }
  })
  it("opening the wizard is not a start; selecting a photo is a real start and retries reuse the event ID", async () => {
    saveBrowserConsent(false, true)
    const view = render(<CreateListingWizard categories={[]} brands={[]} sizes={[]} initialSellerPhone="555123456" userId="user-one" />)
    expect(fetch).not.toHaveBeenCalled()
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement
    const user = userEvent.setup()
    const file = new File(["test"], "coat.jpg", { type: "image/jpeg" })
    await user.upload(input, file)
    expect(fetch).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(payload.event_name).toBe("listing_started")
    await user.upload(input, new File(["test"], "coat2.jpg", { type: "image/jpeg" }))
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
