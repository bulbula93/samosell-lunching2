import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST as vitals } from "@/app/api/web-vitals/route"
import { POST as impression } from "@/app/api/ads/events/route"
import { serverAllowsAnalytics } from "@/lib/browser-consent-server"
import { cookieConsent, CONSENT_COOKIE } from "@/lib/browser-preferences"
const mocks = vi.hoisted(() => ({ admin: vi.fn(), after: vi.fn(), cookieValue: "" }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }))
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: mocks.after }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: mocks.cookieValue }) }) }))
const decision = (analytics: boolean) => encodeURIComponent(JSON.stringify({ version: 1, analytics, personalization: false, updatedAt: Date.now() }))
beforeEach(() => { vi.clearAllMocks(); mocks.cookieValue = "" })
describe("server analytics consent", () => {
  it("defaults to denied and rejects malformed/expired cookie choices", async () => {
    expect(await serverAllowsAnalytics()).toBe(false)
    expect(cookieConsent(`${CONSENT_COOKIE}=%broken`)).toBeNull()
    mocks.cookieValue = decision(true)
    expect(await serverAllowsAnalytics()).toBe(true)
    mocks.cookieValue = decision(false)
    expect(await serverAllowsAnalytics()).toBe(false)
  })
  it("does not write web vitals without analytics permission", async () => {
    const response = await vitals(new Request("https://samosell.ge/api/web-vitals", { method: "POST", body: "{}" }))
    expect(response.status).toBe(204)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("does not record ad impressions without analytics permission", async () => {
    const body = JSON.stringify({ adId: "11111111-1111-4111-8111-111111111111", placementKey: "catalog_top_left", pagePath: "/catalog", eventType: "impression" })
    const response = await impression(new Request("https://samosell.ge/api/ads/events", { method: "POST", body }))
    expect(response.status).toBe(204)
    expect(mocks.after).not.toHaveBeenCalled()
    const accepted = await impression(new Request("https://samosell.ge/api/ads/events", { method: "POST", body, headers: { cookie: `${CONSENT_COOKIE}=${decision(true)}` } }))
    expect(accepted.status).toBe(202)
    expect(mocks.after).toHaveBeenCalledOnce()
  })
})
