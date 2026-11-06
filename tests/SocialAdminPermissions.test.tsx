/** Permission tests: admin-only UI/actions, fail-closed backend, protected worker route, and UI rendering. */
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  createSocialStore: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ requireAdminUser: mocks.requireAdminUser }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: vi.fn() }))
vi.mock("@/lib/social/supabase-store", () => ({ createSocialStore: mocks.createSocialStore }))

import * as actions from "@/app/admin/social/actions"
import SocialControlCenter from "@/app/admin/social/page"
import { GET as tick } from "@/app/api/internal/social/tick/route"
import { MemorySocialStore } from "@/lib/social/store"

const ADMIN = { user: { id: "11111111-1111-4111-8111-111111111111" } }
const allActions = [
  ["runPlanningAction", () => actions.runPlanningAction()],
  ["approvePostAction", () => actions.approvePostAction(new FormData())],
  ["rejectPostAction", () => actions.rejectPostAction(new FormData())],
  ["editCaptionAction", () => actions.editCaptionAction(new FormData())],
  ["rerunQualityAction", () => actions.rerunQualityAction(new FormData())],
  ["draftAdAction", () => actions.draftAdAction(new FormData())],
  ["killSwitchAction", () => actions.killSwitchAction(new FormData())],
  ["settingsAction", () => actions.settingsAction(new FormData())],
  ["runTickAction", () => actions.runTickAction()],
] as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`) })
})
afterEach(() => { vi.unstubAllEnvs() })

describe("server actions are admin-only and fail closed", () => {
  for (const [name, call] of allActions) {
    it(`${name}: non-admin is redirected before any store is created`, async () => {
      mocks.requireAdminUser.mockImplementation(async () => { throw new Error("REDIRECT:/dashboard") })
      await expect(call()).rejects.toThrow("REDIRECT:/dashboard")
      expect(mocks.createSocialStore).not.toHaveBeenCalled()
    })
    it(`${name}: admin without an allowed backend gets an error, no writes`, async () => {
      mocks.requireAdminUser.mockResolvedValue(ADMIN)
      mocks.createSocialStore.mockReturnValue(null)
      await expect(call()).rejects.toThrow(/REDIRECT:\/admin\/social\?error=/)
    })
  }
  it("approval with a forged post id is rejected as invalid input", async () => {
    mocks.requireAdminUser.mockResolvedValue(ADMIN)
    mocks.createSocialStore.mockReturnValue(new MemorySocialStore())
    const fd = new FormData(); fd.set("postId", "../../etc"); fd.set("version", "1")
    await expect(actions.approvePostAction(fd)).rejects.toThrow("REDIRECT:/admin/social?error=invalid_input")
  })
  it("settings cannot enable live mode from a preview runtime", async () => {
    mocks.requireAdminUser.mockResolvedValue(ADMIN)
    const store = new MemorySocialStore(undefined, { killSwitch: false })
    mocks.createSocialStore.mockReturnValue(store)
    const fd = new FormData(); fd.set("executionMode", "live"); fd.set("instagram", "on"); fd.set("facebook", "on")
    await expect(actions.settingsAction(fd)).rejects.toThrow(/error=/)
    expect(store.control.executionMode).toBe("dry_run")
  })
  it("kill switch toggles and is audited with the admin id", async () => {
    mocks.requireAdminUser.mockResolvedValue(ADMIN)
    const store = new MemorySocialStore(undefined, { killSwitch: false })
    mocks.createSocialStore.mockReturnValue(store)
    const fd = new FormData(); fd.set("engage", "true")
    await expect(actions.killSwitchAction(fd)).rejects.toThrow("REDIRECT:/admin/social?ok=kill_switch_engaged")
    expect(store.control.killSwitch).toBe(true)
    expect(store.audit.at(-1)).toMatchObject({ actorType: "human", actor: ADMIN.user.id, action: "kill_switch_on" })
  })
})

describe("worker route", () => {
  it("rejects without the worker flag, secret, or with a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret")
    expect((await tick(new Request("http://x/api", { headers: { authorization: "Bearer s3cret" } }))).status).toBe(401) // worker disabled
    vi.stubEnv("SOCIAL_WORKER_ENABLED", "true")
    expect((await tick(new Request("http://x/api", { headers: { authorization: "Bearer wrong!" } }))).status).toBe(401)
    expect((await tick(new Request("http://x/api"))).status).toBe(401)
    expect(mocks.createSocialStore).not.toHaveBeenCalled()
  })
})

describe("control center page", () => {
  it("non-admins never see the page", async () => {
    mocks.requireAdminUser.mockImplementation(async () => { throw new Error("REDIRECT:/dashboard") })
    await expect(SocialControlCenter({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/dashboard")
  })
  it("without a backend renders a clearly labelled simulation with policy badges", async () => {
    mocks.requireAdminUser.mockResolvedValue(ADMIN)
    mocks.createSocialStore.mockReturnValue(null)
    render(await SocialControlCenter({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("heading", { name: "AI Marketing Control Center" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("სიმულაცია")
    expect(screen.getByText(/Ads ბიუჯეტი: \$0\/დღე/)).toBeInTheDocument()
    expect(screen.getByText("TikTok: გამორთული")).toBeInTheDocument()
    expect(screen.getByText("რეჟიმი: dry-run")).toBeInTheDocument()
    expect(screen.getAllByLabelText("Instagram preview").length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText("Facebook preview").length).toBeGreaterThan(0)
    // Simulation is read-only: every control button is disabled, no approve buttons are rendered.
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled()
    expect(screen.queryByText(/დამტკიცება და რიგში/)).toBeNull()
  })
  it("with a backend shows approve controls for posts awaiting review", async () => {
    mocks.requireAdminUser.mockResolvedValue(ADMIN)
    const store = new MemorySocialStore(undefined, { killSwitch: false })
    const { runPlanningCycle } = await import("@/lib/social/orchestrator")
    const { resolveSocialRuntime } = await import("@/lib/social/runtime")
    const { SIMULATION_LISTINGS } = await import("@/lib/social/simulation")
    const { mondayOf } = await import("@/lib/social/agents/strategy")
    await runPlanningCycle({ store, runtime: resolveSocialRuntime({ VERCEL_ENV: "preview" }) }, { weekStart: mondayOf(new Date(Date.now() + 7 * 864e5)), listings: SIMULATION_LISTINGS })
    mocks.createSocialStore.mockReturnValue(store)
    render(await SocialControlCenter({ searchParams: Promise.resolve({ ok: "settings_saved" }) }))
    expect(screen.getAllByText(/დამტკიცება და რიგში ჩაყენება \(dry_run\)/).length).toBe(5)
    expect(screen.getByText("პარამეტრები შენახულია.")).toBeInTheDocument()
  })
})
