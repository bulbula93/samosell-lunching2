// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ user: null as null | { id: string }, rpc: vi.fn(), after: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } })) }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: state.rpc }) }))
vi.mock("next/server", () => ({ after: state.after }))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))
import { POST } from "@/app/api/growth/events/route"
const anon = "11111111-1111-4111-8111-111111111111"
function request(body: unknown, analytics = true, marketing = false, extra: Record<string, string> = {}) {
  return new Request("https://preview.example/api/growth/events", { method: "POST", headers: { origin: "https://preview.example", cookie: `samosell_browser_consent=${encodeURIComponent(JSON.stringify({ version: 1, personalization: false, analytics, marketing, updatedAt: Date.now() }))}${state.user ? "; sb-example-auth-token=fake" : ""}`, ...extra }, body: JSON.stringify(body) })
}
const event = () => ({ event_name: "page_view", event_id: crypto.randomUUID(), path: "/sell?code=secret", user_id: anon, context: { anonymous_id: anon, session_id: anon, first_touch: { utm_source: "meta" }, last_touch: {}, expires_at: Date.now()+86400_000, last_seen: Date.now() } })
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("GROWTH_TRACKING_ENABLED", "true"); vi.stubEnv("VERCEL_ENV", "development"); vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "false"); state.user = null; state.rpc.mockResolvedValue({ data: [], error: null }) })
describe("Growth ingestion security", () => {
  it("accepts anonymous consented visitors but derives user ID itself", async () => {
    const result = await POST(request(event()))
    expect(result.status).toBe(200)
    expect(state.rpc).toHaveBeenCalledWith("ingest_growth_browser_event", { p_event: expect.objectContaining({ user_id: null, path: "/sell", marketing_consent: false }) })
  })
  it("links logged-in visitors to verified authentication", async () => {
    state.user = { id: "actual-user" }
    await POST(request(event(), true, true))
    expect(state.rpc).toHaveBeenCalledWith("ingest_growth_browser_event", { p_event: expect.objectContaining({ user_id: "actual-user", marketing_consent: true }) })
  })
  it("rejects forged purchase, registration and publish events", async () => {
    for (const name of ["boost_purchase_completed", "registration_completed", "listing_published"]) expect((await POST(request({ ...event(), event_name: name }))).status).toBe(400)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("cannot use identify as a lookup for another seller's public conversion key", async () => {
    const result = await POST(request({ ...event(), event_name: "identify", event_id: `listing_published:${anon}` }))
    expect(result.status).toBe(400)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("rejects unauthenticated listing starts and accepts a real form interaction", async () => {
    const body = { ...event(), event_name: "listing_started", event_id: `listing_started:${anon}`, attempt_id: anon, path: "/dashboard/listings/new" }
    expect((await POST(request(body))).status).toBe(403)
    state.user = { id: "actual-user" }
    expect((await POST(request(body))).status).toBe(200)
  })
  it("does no optional database work after denied consent", async () => {
    await POST(request(event(), false))
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("rejects cross-origin and oversized requests", async () => {
    expect((await POST(request(event(), true, false, { origin: "https://other.example" }))).status).toBe(403)
    expect((await POST(request({ payload: "a".repeat(5000) }))).status).toBe(413)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("blocks tracking in a Preview connected to Production even if enabled by mistake", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("PREVIEW_GROWTH_DATABASE_REF", "lxsvjzbiuewgwpajqrwr")
    expect(await (await POST(request(event()))).json()).toMatchObject({ enabled: false })
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("allows anonymous consent withdrawal without adding a tracking event", async () => {
    await POST(request({ event_name: "consent_revoked", anonymous_id: anon }, false))
    expect(state.rpc).toHaveBeenCalledWith("revoke_growth_consent", expect.objectContaining({ p_user_id: null, p_anonymous_id: anon }))
  })
  it("surfaces ingestion failure without exposing database details", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "42P01", message: "secret internal detail" } })
    const result = await POST(request(event()))
    expect(result.status).toBe(503); expect(await result.text()).not.toContain("secret")
  })
})
