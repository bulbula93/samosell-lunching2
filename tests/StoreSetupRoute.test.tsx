import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import StoreSetupPage from "@/app/dashboard/store/setup/page"
import DashboardProfilePage from "@/app/dashboard/profile/page"
import { loadEditableProfile } from "@/lib/profile-editor-server"
import { STORE_SETUP_PATH } from "@/lib/store-onboarding"

const db = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), redirect: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: db.redirect }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: db.getUser }, from: db.from }) }))
vi.mock("@/components/dashboard/ProfileForm", () => ({
  default: ({ userId, initialProfile, continuePath, startStoreSetup }: { userId: string; initialProfile: { full_name: string }; continuePath: string; startStoreSetup: boolean }) =>
    <div data-testid="setup-form" data-owner={userId} data-continue={continuePath} data-setup={String(startStoreSetup)}>{initialProfile.full_name}</div>,
}))

beforeEach(() => {
  vi.resetAllMocks()
  db.redirect.mockImplementation(path => { throw new Error(`redirect:${path}`) })
  db.getUser.mockResolvedValue({ data: { user: { id: "current-owner" } } })
  const query = { select: db.select, eq: db.eq, maybeSingle: db.maybeSingle }
  db.from.mockReturnValue(query); db.select.mockReturnValue(query); db.eq.mockReturnValue(query)
  db.maybeSingle.mockResolvedValue({ data: { username: "my_shop", full_name: "ჩემი მაღაზია", seller_type: "individual" }, error: null })
})

describe("Authenticated store creation page", () => {
  it("loads only the signed-in owner's profile and preserves the next step", async () => {
    render(await StoreSetupPage({ searchParams: Promise.resolve({ next: "/dashboard/listings/new" }) }))
    expect(screen.getByTestId("setup-form")).toHaveTextContent("ჩემი მაღაზია")
    expect(screen.getByTestId("setup-form")).toHaveAttribute("data-owner", "current-owner")
    expect(screen.getByTestId("setup-form")).toHaveAttribute("data-continue", "/dashboard/listings/new")
    expect(screen.getByTestId("setup-form")).toHaveAttribute("data-setup", "true")
    expect(db.eq).toHaveBeenCalledWith("id", "current-owner")
  })

  it("requires authentication and keeps the creation destination for sign-in", async () => {
    db.getUser.mockResolvedValue({ data: { user: null } })
    await expect(StoreSetupPage({})).rejects.toThrow(`redirect:/login?next=${encodeURIComponent(STORE_SETUP_PATH)}`)
    expect(db.from).not.toHaveBeenCalled()
  })

  it("maps the existing store setup link to the new builder", async () => {
    await expect(DashboardProfilePage({ searchParams: Promise.resolve({ setup: "store" }) })).rejects.toThrow(`redirect:${STORE_SETUP_PATH}`)
    expect(db.getUser).not.toHaveBeenCalled()
  })

  it("does not render an empty form when loading an existing profile fails", async () => {
    db.maybeSingle.mockResolvedValue({ data: null, error: { message: "network error" } })
    await expect(StoreSetupPage({})).rejects.toThrow("პროფილის ჩატვირთვა ვერ მოხერხდა")
  })

  it("loads saved store text and branding rather than replacing them with demo content", async () => {
    db.maybeSingle.mockResolvedValueOnce({ data: { full_name: "არსებული მაღაზია", seller_type: "store", store_banner_url: "https://example.test/saved.png" }, error: null })
      .mockResolvedValueOnce({ data: { store_hero: { headline: "არსებული სათაური" } }, error: null })
    const profile = await loadEditableProfile({ from: db.from } as unknown as Parameters<typeof loadEditableProfile>[0], "current-owner")
    expect(profile.store_banner_url).toBe("https://example.test/saved.png")
    expect(profile.store_hero.headline).toBe("არსებული სათაური")
    expect(profile.username).toBe("")
  })
})
