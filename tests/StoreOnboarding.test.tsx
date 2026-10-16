import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import RegisterForm from "@/components/auth/RegisterForm"
import ProfileForm from "@/components/dashboard/ProfileForm"
import { EMPTY_EDITABLE_PROFILE } from "@/lib/profile-editor"
import { getRegistrationContinuePath, getStoreSetupContinuePath, getStoreSetupPath, STORE_SETUP_PATH } from "@/lib/store-onboarding"

const db = vi.hoisted(() => ({
  signUp: vi.fn(), oauth: vi.fn(), push: vi.fn(), refresh: vi.fn(),
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn(), single: vi.fn(),
  storageFrom: vi.fn(), upload: vi.fn(), getPublicUrl: vi.fn(), remove: vi.fn(),
}))
const NativeURL = URL
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: db.push, refresh: db.refresh }) }))
vi.mock("@/lib/store-cover-color-client", () => ({ readStoreCoverColor: vi.fn(async () => null) }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  auth: { signUp: db.signUp, signInWithOAuth: db.oauth },
  from: db.from, storage: { from: db.storageFrom },
}) }))

beforeEach(() => {
  vi.resetAllMocks()
  db.signUp.mockResolvedValue({ data: { session: null }, error: null })
  db.oauth.mockResolvedValue({ error: null })
  const query = { select: db.select, eq: db.eq, maybeSingle: db.maybeSingle, upsert: db.upsert, single: db.single }
  db.from.mockReturnValue(query); db.select.mockReturnValue(query); db.eq.mockReturnValue(query); db.upsert.mockReturnValue(query)
  db.maybeSingle.mockResolvedValue({ data: { store_hero: {} }, error: null })
  db.single.mockResolvedValue({ data: { id: "owner-id" }, error: null })
  db.storageFrom.mockReturnValue({ upload: db.upload, getPublicUrl: db.getPublicUrl, remove: db.remove })
  db.upload.mockResolvedValue({ error: null })
  db.getPublicUrl.mockImplementation(path => ({ data: { publicUrl: `https://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/public/store-branding/${path}` } }))
  db.remove.mockResolvedValue({ error: null })
  vi.stubGlobal("fetch", vi.fn())
  vi.stubGlobal("URL", class extends NativeURL {
    static createObjectURL = vi.fn(() => "blob:cover")
    static revokeObjectURL = vi.fn()
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

async function enterAccount() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Email"), "owner@example.com")
  await user.type(screen.getByLabelText("Password"), "password123")
  await user.click(screen.getByRole("button", { name: "შექმენი ანგარიში და გააგრძელე" }))
}

const initial = { ...EMPTY_EDITABLE_PROFILE, username: "my_shop", full_name: "ჩემი მაღაზია" }
function renderSetup(continuePath = "/dashboard/listings/new") {
  return render(<ProfileForm startStoreSetup userId="owner-id" initialProfile={initial} continuePath={continuePath} />)
}

describe("Store registration continuation", () => {
  it("preselects a store from the shops CTA and carries its builder through confirmation", async () => {
    render(<RegisterForm nextPath={STORE_SETUP_PATH} />)
    expect(screen.getByRole("radio", { name: /^მაღაზია/ })).toBeChecked()
    await enterAccount()
    const options = db.signUp.mock.calls[0][0].options
    expect(new URL(options.emailRedirectTo).searchParams.get("next")).toBe(STORE_SETUP_PATH)
    expect(options.data.seller_type).toBe("store")
    expect(db.push).not.toHaveBeenCalled()
    expect(screen.getByText(/შემდეგ მაღაზიის შექმნას კონსტრუქტორში გააგრძელებ/)).toBeVisible()
  })

  it("starts the builder for a confirmed session and keeps the original listing destination", async () => {
    db.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null })
    render(<RegisterForm nextPath="/dashboard/listings/new" />)
    await userEvent.click(screen.getByRole("radio", { name: /^მაღაზია/ }))
    await enterAccount()
    expect(db.push).toHaveBeenCalledWith(getStoreSetupPath("/dashboard/listings/new"))
    expect(db.refresh).toHaveBeenCalledOnce()
  })

  it("carries store selection through Google and existing-account login, then restores the individual route", async () => {
    const user = userEvent.setup()
    render(<RegisterForm nextPath="/dashboard/listings/new" />)
    await user.click(screen.getByRole("radio", { name: /^მაღაზია/ }))
    const next = getStoreSetupPath("/dashboard/listings/new")
    expect(screen.getByRole("link", { name: /შესვლა/ })).toHaveAttribute("href", `/login?next=${encodeURIComponent(next)}`)
    await user.click(screen.getByRole("button", { name: /Google/ }))
    expect(new URL(db.oauth.mock.calls[0][0].options.redirectTo).searchParams.get("next")).toBe(next)
    await user.click(screen.getByRole("radio", { name: /^ფიზიკური გამყიდველი/ }))
    expect(screen.getByRole("button", { name: "რეგისტრაცია" })).toBeVisible()
    expect(screen.getByRole("link", { name: /შესვლა/ })).toHaveAttribute("href", "/login?next=%2Fdashboard%2Flistings%2Fnew")
  })

  it("does not send signup requests from the read-only review Preview", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true")
    vi.stubEnv("VERCEL_ENV", "preview")
    render(<RegisterForm nextPath={STORE_SETUP_PATH} />)
    await enterAccount()
    expect(db.signUp).not.toHaveBeenCalled()
    expect(screen.getByText(/რეგისტრაცია გამორთულია/)).toBeVisible()
  })

  it("keeps safe return routes and prevents nested setup or authentication loops", () => {
    expect(getStoreSetupPath("/dashboard/profile?setup=store")).toBe(STORE_SETUP_PATH)
    expect(getStoreSetupPath(getStoreSetupPath("/catalog?sort=new"))).toBe(getStoreSetupPath("/catalog?sort=new"))
    expect(getStoreSetupPath("https://evil.example")).toBe(STORE_SETUP_PATH)
    expect(getStoreSetupContinuePath("/login?next=/")).toBe("/dashboard")
    expect(getStoreSetupContinuePath("/dashboard/profile?setup=store")).toBe("/dashboard")
    expect(getRegistrationContinuePath("individual", STORE_SETUP_PATH)).toBe("/dashboard")
    expect(getRegistrationContinuePath("individual", "/dashboard/listings/new")).toBe("/dashboard/listings/new")
  })
})

describe("Real store setup persistence", () => {
  it("uploads the chosen cover and saves the complete store before continuing", async () => {
    const user = userEvent.setup()
    renderSetup()
    await user.type(screen.getByLabelText("მთავარი სათაური"), "შერჩეული კოლექცია")
    await user.type(screen.getByLabelText("Instagram"), "@my_shop")
    await user.upload(screen.getByLabelText("მაღაზიის ქავერი"), new File(["cover"], "cover.png", { type: "image/png" }))
    await user.click(screen.getByRole("checkbox", { name: "მაქვს ფიზიკური მაღაზია" }))
    await user.type(screen.getByLabelText("ფიზიკური მაღაზიის მისამართი"), "თბილისი, აბაშიძის 10")
    await user.click(screen.getByRole("button", { name: "შეინახე მაღაზია და გააგრძელე" }))
    await waitFor(() => expect(db.push).toHaveBeenCalledWith("/dashboard/listings/new"))
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "owner-id", seller_type: "store", full_name: "ჩემი მაღაზია", username: "my_shop",
      store_hero: expect.objectContaining({ headline: "შერჩეული კოლექცია" }),
      store_instagram: "@my_shop", store_address: "თბილისი, აბაშიძის 10",
      store_banner_url: expect.stringMatching(/owner-id\/\d+-store-banner.png$/),
    }))
    expect(db.single).toHaveBeenCalledOnce()
    expect(db.upsert.mock.invocationCallOrder[0]).toBeGreaterThan(db.upload.mock.invocationCallOrder[0])
    expect(db.push.mock.invocationCallOrder[0]).toBeGreaterThan(db.single.mock.invocationCallOrder[0])
    expect(db.refresh).toHaveBeenCalledOnce()
  })

  it("clears physical-store details when registering an online-only shop", async () => {
    render(<ProfileForm startStoreSetup userId="owner-id" initialProfile={{ ...initial, store_address: "ძველი მისამართი", store_map_url: "https://maps.google.com/", store_hours: "10–19" }} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole("checkbox", { name: "მაქვს ფიზიკური მაღაზია" }))
    await user.click(screen.getByRole("button", { name: "შეინახე მაღაზია და გააგრძელე" }))
    await waitFor(() => expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ store_address: null, store_map_url: null, store_hours: null })))
    expect(db.push).toHaveBeenCalledWith("/dashboard")
  })

  it("rolls back new uploads and keeps the editor open if saving fails", async () => {
    db.single.mockResolvedValue({ data: null, error: { message: "duplicate key value violates unique constraint" } })
    const user = userEvent.setup()
    renderSetup()
    await user.upload(screen.getByLabelText("მაღაზიის ქავერი"), new File(["cover"], "cover.png", { type: "image/png" }))
    await user.click(screen.getByRole("button", { name: "შეინახე მაღაზია და გააგრძელე" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("ასეთი ჩანაწერი უკვე არსებობს")
    expect(db.remove).toHaveBeenCalledWith([expect.stringMatching(/^owner-id\/\d+-store-banner.png$/)])
    expect(db.push).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "შეინახე მაღაზია და გააგრძელე" })).toBeEnabled()
  })

  it("does not upload assets if profile access fails", async () => {
    db.maybeSingle.mockRejectedValue(new Error("connection failed"))
    const user = userEvent.setup()
    renderSetup()
    await user.upload(screen.getByLabelText("მაღაზიის ქავერი"), new File(["cover"], "cover.png", { type: "image/png" }))
    await user.click(screen.getByRole("button", { name: "შეინახე მაღაზია და გააგრძელე" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("connection failed")
    expect(db.upload).not.toHaveBeenCalled()
    expect(db.upsert).not.toHaveBeenCalled()
    expect(db.push).not.toHaveBeenCalled()
  })

  it("blocks all writes from a read-only Preview, even if the form is submitted directly", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true")
    vi.stubEnv("VERCEL_ENV", "preview")
    renderSetup()
    fireEvent.submit(screen.getByRole("form", { name: "მაღაზიის შექმნა" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("შენახვა გამორთულია")
    expect(db.from).not.toHaveBeenCalled()
    expect(db.upload).not.toHaveBeenCalled()
  })
})
