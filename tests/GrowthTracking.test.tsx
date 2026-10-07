import { act, render, screen } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { saveBrowserConsent, parseConsent, CONSENT_COOKIE } from "@/lib/browser-preferences"
import { growthContext, clearGrowthStorage, listingAttempt, clearListingAttempt, trackGrowth } from "@/lib/growth/client"
import { growthPeriod, safePath, cleanTouch, META_MAPPING, GROWTH_KEY, type GrowthEvent } from "@/lib/growth/shared"
import { growthWritesEnabled } from "@/lib/growth/server"
import { metaServerPayload } from "@/lib/growth/meta-server"
import { trackMetaBrowser } from "@/lib/growth/meta-browser"
import GrowthDashboard from "@/components/growth/GrowthDashboard"
import GrowthInstrumentation from "@/components/growth/GrowthInstrumentation"
import { previewSafeFetch } from "@/lib/preview-read-only"

const nav = vi.hoisted(() => ({ path: "/sell", query: new URLSearchParams() }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useSearchParams: () => nav.query }))
vi.mock("next/headers", () => ({ cookies: vi.fn() }))
const pixel = "123456789"
beforeEach(() => {
  vi.unstubAllEnvs(); vi.restoreAllMocks(); clearGrowthStorage(); localStorage.clear(); sessionStorage.clear()
  document.cookie = `${CONSENT_COOKIE}=; Path=/; Max-Age=0`
  window.history.replaceState({}, "", "/sell")
  nav.path = "/sell"; nav.query = new URLSearchParams()
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ conversions: [] }) }))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe("Growth consent, UTM and sessions", () => {
  it("keeps legacy analytics permission separate from marketing", () => {
    expect(parseConsent(JSON.stringify({ version: 1, analytics: true, personalization: false, updatedAt: Date.now() }))?.marketing).toBe(false)
    expect(saveBrowserConsent(false, false, true).marketing).toBe(false)
  })
  it("does not create an identifier, event or script before consent / with consent denied", async () => {
    expect(growthContext()).toBeNull(); await trackGrowth("page_view")
    saveBrowserConsent(false, false); await trackGrowth("page_view")
    expect(fetch).not.toHaveBeenCalled(); expect(localStorage.getItem(GROWTH_KEY)).toBeNull()
    expect(document.querySelector('script[src*="facebook"]')).toBeNull()
  })
  it("preserves first and latest UTM across landing, login, register and dashboard navigation", () => {
    saveBrowserConsent(false, true)
    history.replaceState({}, "", "/sell?utm_source=meta&utm_medium=paid_social&utm_campaign=seller_acquisition_oct26&utm_content=reel_closet_01&utm_term=clothes")
    const first = growthContext()!
    for (const route of ["/login?next=%2Fdashboard%2Flistings%2Fnew", "/register", "/dashboard/listings/new"]) {
      history.replaceState({}, "", route)
      const next = growthContext()!
      expect(next.first_touch).toEqual(first.first_touch); expect(next.session_id).toBe(first.session_id); expect(next.anonymous_id).toBe(first.anonymous_id)
    }
    history.replaceState({}, "", "/sell?utm_source=instagram&utm_campaign=second")
    const second = growthContext()!
    expect(second.first_touch.utm_source).toBe("meta"); expect(second.last_touch.utm_source).toBe("instagram")
  })
  it("renews the session after 30 minutes of inactivity", () => {
    saveBrowserConsent(false, true)
    const first = growthContext()!
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31 * 60_000)
    expect(growthContext()!.session_id).not.toBe(first.session_id)
    expect(growthContext()!.anonymous_id).toBe(first.anonymous_id)
  })
  it("supports storage blocked without touching authentication cookies", () => {
    saveBrowserConsent(false, true); document.cookie = "sb-example-auth-token=keep; Path=/"
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked") })
    expect(growthContext()).not.toBeNull()
    clearGrowthStorage()
    expect(document.cookie).toContain("sb-example-auth-token=keep")
  })
  it("persists an attempt across refresh and changes it only after successful completion", () => {
    saveBrowserConsent(false, true)
    const id = listingAttempt("seller")
    expect(listingAttempt("seller")).toBe(id)
    clearListingAttempt("seller")
    expect(listingAttempt("seller")).not.toBe(id)
  })
  it("deduplicates in-flight retries using the same event ID and avoids raw auth queries", async () => {
    saveBrowserConsent(false, true)
    history.replaceState({}, "", "/auth/callback?code=private-secret&email=private@example.com")
    await Promise.all([trackGrowth("page_view", "event-one"), trackGrowth("page_view", "event-one")])
    expect(fetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.path).toBe("/auth/callback"); expect(JSON.stringify(body)).not.toMatch(/private-secret|private@example/)
  })
  it("tracks a query navigation without double-counting rerenders", async () => {
    saveBrowserConsent(false, true)
    const view = render(<GrowthInstrumentation />)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    expect(vi.mocked(fetch).mock.calls.filter(([, opts]) => String(opts?.body).includes('"page_view"'))).toHaveLength(1)
    view.rerender(<GrowthInstrumentation />)
    nav.query = new URLSearchParams("page=2"); view.rerender(<GrowthInstrumentation />)
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    expect(vi.mocked(fetch).mock.calls.filter(([, opts]) => String(opts?.body).includes('"page_view"'))).toHaveLength(2)
  })
  it("removes optional storage on withdrawal", () => {
    saveBrowserConsent(false, true); growthContext()
    saveBrowserConsent(false, false)
    expect(growthContext()).toBeNull(); expect(localStorage.getItem(GROWTH_KEY)).toBeNull()
  })
})
describe("Growth data safety and period semantics", () => {
  it("rejects email/URL UTM data and strips referrer query and path", () => {
    expect(cleanTouch({ utm_source: "test@example.com", utm_content: "https://private.example/token", referrer: "https://instagram.com/secret?q=token" })).toEqual({ referrer: "https://instagram.com" })
    expect(safePath("/dashboard/chats/4b346fc2-889e-4ad8-8964-51a1c31240f6?token=x")).toBe("/dashboard/chats/:id")
  })
  it("uses Tbilisi midnight and inclusive calendar days", () => {
    const now = new Date("2026-10-07T08:55:40Z")
    expect(growthPeriod("today", now).from).toBe("2026-10-06T20:00:00.000Z")
    expect(growthPeriod("7", now).from).toBe("2026-09-30T20:00:00.000Z")
    expect(growthPeriod("30", now).days).toBe(30)
  })
  it("requires explicit Preview isolation to enable writes", () => {
    vi.stubEnv("GROWTH_TRACKING_ENABLED", "true"); vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lxsvjzbiuewgwpajqrwr.supabase.co")
    vi.stubEnv("PREVIEW_GROWTH_DATABASE_REF", "lxsvjzbiuewgwpajqrwr")
    expect(growthWritesEnabled()).toBe(false)
    vi.stubEnv("PREVIEW_GROWTH_DATABASE_REF", "isolated-preview")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isolated-preview.supabase.co")
    expect(growthWritesEnabled()).toBe(true)
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true")
    expect(growthWritesEnabled()).toBe(false)
  })
  it("blocks all Preview Supabase write transports while allowing reads", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true"); vi.stubEnv("VERCEL_ENV", "preview")
    const result = await previewSafeFetch("https://example.supabase.co/rest/v1/listings", { method: "POST" })
    expect(result.status).toBe(403); expect(fetch).not.toHaveBeenCalled()
    await previewSafeFetch("https://example.supabase.co/rest/v1/listings", { method: "GET" })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
describe("Meta readiness", () => {
  const event: GrowthEvent = { event_name: "boost_purchase_completed", event_id: "boost_purchase_completed:boost:order-one", user_id: "user-one", product_id: "vip-max", amount: 9.9, currency: "GEL", marketing_consent: true }
  it("maps all requested events with identical browser/server names", () => {
    expect(Object.values(META_MAPPING).map(item => item.name)).toEqual(["PageView", "CompleteRegistration", "StartListing", "PublishListing", "InitiateCheckout", "Purchase"])
  })
  it("sends hashed identifier, GEL value and exact authoritative event ID", () => {
    const payload = metaServerPayload(event)!
    expect(payload.event_id).toBe(event.event_id); expect(payload.event_name).toBe("Purchase")
    expect(payload.custom_data).toMatchObject({ value: 9.9, currency: "GEL", content_ids: ["vip-max"] })
    expect(payload.user_data.external_id[0]).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(payload)).not.toContain("user-one")
    expect(metaServerPayload({ ...event, marketing_consent: false })).toBeNull()
  })
  it("loads no Pixel on analytics-only consent; deduplicates after marketing acceptance", () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", pixel)
    saveBrowserConsent(false, true)
    window.fbq = Object.assign(vi.fn(), { queue: [] })
    trackMetaBrowser(event); expect(window.fbq).not.toHaveBeenCalled()
    saveBrowserConsent(false, true, true)
    trackMetaBrowser(event); trackMetaBrowser(event)
    expect(vi.mocked(window.fbq).mock.calls.filter(args => args[0] === "track")).toHaveLength(1)
    expect(window.fbq).toHaveBeenCalledWith("track", "Purchase", expect.objectContaining({ value: 9.9, currency: "GEL" }), { eventID: event.event_id })
    delete window.fbq
  })
})
it("shows unavailable metrics instead of fake zeros and has a spend empty state", () => {
  render(<GrowthDashboard summary={null} period="7" />)
  expect(screen.getByRole("heading", { name: "Growth / Analytics" })).toBeInTheDocument()
  expect(screen.getByText("Meta Ads spend data not connected")).toBeInTheDocument()
  expect(screen.queryByLabelText("Growth metrics")).not.toBeInTheDocument()
})
