import { readFileSync } from "node:fs"
import { join } from "node:path"
import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { HomePersonalizationProvider, useHomePersonalization } from "@/components/home/HomePersonalizationProvider"

const session = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  getSession: async () => ({ data: { session: session.user ? { user: session.user } : null } }),
} }) }))

function State() {
  const value = useHomePersonalization()
  return <output data-testid="state">{JSON.stringify({ loaded: value?.loaded, user: value?.userState })}</output>
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!)

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); session.user = null })

describe("homepage header does not wait on the database", () => {
  it("shows the signed-in header from the local session while the API is still pending", async () => {
    session.user = { id: "u1", user_metadata: { full_name: "Giorgi", avatar_url: "https://lh3.googleusercontent.com/a.png" } }
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
    render(<HomePersonalizationProvider><State /></HomePersonalizationProvider>)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    expect(state().loaded).toBe(true)
    expect(state().user).toMatchObject({ userId: "u1", signedIn: true, profileLabel: "Giorgi", profileImage: "https://lh3.googleusercontent.com/a.png" })
  })

  it("lets the API response replace the provisional header", async () => {
    session.user = { id: "u1", user_metadata: {} }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      userState: { userId: "u1", signedIn: true, profileLabel: "Profile Name", profileImage: null, isAdmin: true, unreadNotifications: 3, unreadChats: 1 },
      favoriteIds: ["l1"], storyRail: null,
    }))))
    render(<HomePersonalizationProvider><State /></HomePersonalizationProvider>)
    await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve() })

    expect(state().user).toMatchObject({ profileLabel: "Profile Name", isAdmin: true, unreadNotifications: 3 })
  })

  it("stops showing the loading skeleton when the API hangs and there is no session", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
    })))
    render(<HomePersonalizationProvider><State /></HomePersonalizationProvider>)
    expect(state().loaded).toBe(false)

    await act(async () => { await vi.advanceTimersByTimeAsync(8000) })

    expect(state().loaded).toBe(true)
    expect(state().user).toMatchObject({ signedIn: false })
  })

  it("keeps the personalization route light: JWT claims, no story rail query", () => {
    const route = readFileSync(join(process.cwd(), "app/api/home-personalization/route.ts"), "utf8")
    expect(route).toContain("auth.getClaims()")
    expect(route).not.toContain("auth.getUser()")
    expect(route).not.toContain("getStoryRailData")
  })
})
