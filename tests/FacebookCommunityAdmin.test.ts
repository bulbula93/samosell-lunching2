// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), single: vi.fn(), writable: true, tag: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAdminUser: state.auth }))
vi.mock("@/lib/facebook-community-server", () => ({ communitySettingsWritesEnabled: () => state.writable, COMMUNITY_SETTINGS_TAG: "facebook-community-settings" }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: state.tag }))
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url) } }))
import { saveFacebookGroupAction } from "@/app/admin/system/actions"
function form(url: string) { const result = new FormData(); result.set("facebook_group_url", url); return result }
beforeEach(() => {
  vi.resetAllMocks(); state.writable = true
  state.single.mockResolvedValue({ data: { facebook_group_url: null }, error: null })
  state.auth.mockResolvedValue({ supabase: { from: () => ({ update: state.update }) } })
  state.update.mockReturnValue({ eq: () => ({ select: () => ({ maybeSingle: state.single }) }) })
})
describe("community admin action", () => {
  it("authenticates before attempting any write", async () => {
    state.auth.mockRejectedValue(new Error("login"))
    await expect(saveFacebookGroupAction(form(""))).rejects.toThrow("login")
    expect(state.update).not.toHaveBeenCalled()
  })
  it("blocks a read-only preview even for an admin", async () => {
    state.writable = false
    await expect(saveFacebookGroupAction(form(""))).rejects.toThrow("community=read_only")
    expect(state.update).not.toHaveBeenCalled()
  })
  it("rejects unsafe destinations before reaching the database", async () => {
    await expect(saveFacebookGroupAction(form("https://evil.test/groups/a/"))).rejects.toThrow("community=invalid_url")
    expect(state.update).not.toHaveBeenCalled()
  })
  it("allows clearing the setting and expires only the public settings cache", async () => {
    await expect(saveFacebookGroupAction(form(""))).rejects.toThrow("community=saved")
    expect(state.update).toHaveBeenCalledWith({ facebook_group_url: null })
    expect(state.tag).toHaveBeenCalledWith("facebook-community-settings")
  })
  it("does not claim success for a denied or missing update", async () => {
    state.single.mockResolvedValue({ data: null, error: null })
    await expect(saveFacebookGroupAction(form(""))).rejects.toThrow("community=unavailable")
    expect(state.tag).not.toHaveBeenCalled()
  })
})
