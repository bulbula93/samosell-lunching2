// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ result: vi.fn() }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/public-server", () => ({ createPublicServerClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: state.result }) }) }) }) }) }))
import { communitySettingsWritesEnabled, getFacebookGroupUrl } from "@/lib/facebook-community-server"
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "false"); vi.stubEnv("VERCEL_ENV", "preview") })
afterEach(() => vi.unstubAllEnvs())
describe("community settings isolation", () => {
  it.each(["https://lxsvjzbiuewgwpajqrwr.supabase.co", "https://lxsvjzbiuewgwpajqrwr.supabase.co/", "https://lxsvjzbiuewgwpajqrwr.supabase.co?preview=1", ""])("blocks preview writes to Production or missing configuration: %s", url => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url)
    expect(communitySettingsWritesEnabled()).toBe(false)
  })
  it("permits an isolated QA backend but honors the read-only flag", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isolated-qa.supabase.co")
    expect(communitySettingsWritesEnabled()).toBe(true)
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true")
    expect(communitySettingsWritesEnabled()).toBe(false)
  })
  it("degrades to an unconfigured group if the migration or backend is unavailable", async () => {
    state.result.mockResolvedValue({ data: null, error: { code: "42P01" } })
    expect(await getFacebookGroupUrl()).toBeNull()
    state.result.mockRejectedValue(new Error("timeout"))
    expect(await getFacebookGroupUrl()).toBeNull()
  })
  it("never renders an unsafe URL stored in the database", async () => {
    state.result.mockResolvedValue({ data: { facebook_group_url: "javascript:alert(1)" }, error: null })
    expect(await getFacebookGroupUrl()).toBeNull()
  })
})
