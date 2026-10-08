// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), auth: vi.fn(), profile: vi.fn(), source: vi.fn(), fx: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: state.rpc, from: state.from }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: state.auth }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: state.profile }) }) }) }) }))
vi.mock("@/lib/growth/meta-spend-source", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/growth/meta-spend-source")>(), fetchMetaDailySpend: state.source, fetchNbgRate: state.fx }))
import { metaSpendBackendAllowed, metaSpendConfigurationStatus, syncMetaSpend } from "@/lib/growth/meta-spend-server"
import { META_AD_ACCOUNT_ID, META_SPEND_QA_REF, metaSpendDates } from "@/lib/growth/meta-spend"
import { MetaSpendError } from "@/lib/growth/meta-spend-source"
import { POST } from "@/app/api/admin/growth/meta-spend/sync/route"
import { GET } from "@/app/api/internal/growth/meta-spend/sync/route"
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "false")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${META_SPEND_QA_REF}.supabase.co`)
  vi.stubEnv("PREVIEW_GROWTH_DATABASE_REF", META_SPEND_QA_REF)
  vi.stubEnv("META_ADS_SPEND_ENABLED", "true"); vi.stubEnv("META_ADS_AD_ACCOUNT_ID", META_AD_ACCOUNT_ID)
  vi.stubEnv("META_ADS_ACCESS_TOKEN", "test-token"); vi.stubEnv("META_ADS_GRAPH_API_VERSION", "v99.0")
  state.rpc.mockResolvedValue({ data: true, error: null })
  state.auth.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })
  state.profile.mockResolvedValue({ data: { is_admin: true }, error: null })
  state.source.mockResolvedValue([])
  state.fx.mockImplementation(async date => ({ rate: 2.5, date, source: "NBG" }))
  state.from.mockReturnValue({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }) })
})
afterEach(() => vi.unstubAllEnvs())
const request = (origin = "https://preview.example") => new Request("https://preview.example/api/admin/growth/meta-spend/sync", { method: "POST", headers: { origin } })
describe("Meta sync orchestration and environment isolation", () => {
  it("blocks Preview Production linkage, other QA projects, read-only previews and local Production", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lxsvjzbiuewgwpajqrwr.supabase.co")
    expect(metaSpendBackendAllowed()).toBe(false)
    await expect(syncMetaSpend()).rejects.toThrow("meta_backend_not_allowed")
    vi.stubEnv("VERCEL_ENV", "development"); expect(metaSpendBackendAllowed()).toBe(false)
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://another-qa.supabase.co"); expect(metaSpendBackendAllowed()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${META_SPEND_QA_REF}.supabase.co`); vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "true"); expect(metaSpendBackendAllowed()).toBe(false)
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.source).not.toHaveBeenCalled()
  })
  it("requires account allowlist, explicit enablement and independent Meta credentials", async () => {
    vi.stubEnv("META_ADS_AD_ACCOUNT_ID", "71020156"); expect(metaSpendConfigurationStatus()).toBe("meta_account_not_configured")
    vi.stubEnv("META_ADS_AD_ACCOUNT_ID", META_AD_ACCOUNT_ID); vi.stubEnv("META_ADS_SPEND_ENABLED", "false"); expect(metaSpendConfigurationStatus()).toBe("meta_sync_disabled")
    vi.stubEnv("META_ADS_SPEND_ENABLED", "true"); vi.stubEnv("META_ADS_ACCESS_TOKEN", ""); await expect(syncMetaSpend()).rejects.toThrow("meta_credentials_missing")
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("writes 30 reported-zero days only after a complete successful Meta report", async () => {
    const result = await syncMetaSpend()
    expect(result).toMatchObject({ accountId: META_AD_ACCOUNT_ID, currency: "USD", days: 30, fxDays: 30 })
    const saved = state.rpc.mock.calls.find(([fn]) => fn === "commit_meta_ads_spend_sync")![1]
    expect(saved.p_rows).toHaveLength(30)
    expect(saved.p_rows.every((row: { spend_amount: string }) => row.spend_amount === "0")).toBe(true)
    expect(state.source).toHaveBeenCalledBefore(state.fx)
  })
  it("does not commit failed source reads or fabricate zero spend", async () => {
    state.source.mockRejectedValue(new MetaSpendError("meta_authorization_failed"))
    await expect(syncMetaSpend()).rejects.toThrow("meta_authorization_failed")
    expect(state.rpc.mock.calls.map(([fn]) => fn)).toEqual(["claim_meta_ads_spend_sync", "fail_meta_ads_spend_sync"])
    expect(state.fx).not.toHaveBeenCalled()
  })
  it("does not duplicate sync work while a lease/cooldown is active", async () => {
    state.rpc.mockResolvedValue({ data: false, error: null })
    await expect(syncMetaSpend()).rejects.toThrow("meta_sync_busy")
    expect(state.source).not.toHaveBeenCalled()
  })
  it("retains existing historical FX and saves unavailable rates as NULL", async () => {
    const date = metaSpendDates("30")[0]
    state.from.mockReturnValue({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ limit: async () => ({ data: [{ date, fx_rate_to_gel: "2.4", fx_rate_date: date, fx_source: "NBG" }], error: null }) }) }) }) }) })
    state.fx.mockResolvedValue(null)
    await syncMetaSpend()
    expect(state.fx).toHaveBeenCalledTimes(29)
    const saved = state.rpc.mock.calls.find(([fn]) => fn === "commit_meta_ads_spend_sync")![1]
    expect(saved.p_rows[0]).toMatchObject({ fx_rate_to_gel: 2.4, fx_source: "NBG" })
    expect(saved.p_rows[1]).toMatchObject({ fx_rate_to_gel: null, fx_source: null })
  })
})
describe("Admin-only manual sync and disabled scheduled sync", () => {
  it("rejects anonymous, non-admin, profile lookup failure and cross-origin mutation", async () => {
    expect((await POST(request("https://evil.example"))).status).toBe(403)
    state.auth.mockResolvedValue({ data: { user: null }, error: null }); expect((await POST(request())).status).toBe(401)
    state.auth.mockResolvedValue({ data: { user: { id: "user" } }, error: null }); state.profile.mockResolvedValue({ data: { is_admin: false }, error: null }); expect((await POST(request())).status).toBe(403)
    state.profile.mockResolvedValue({ data: { is_admin: true }, error: { code: "failed" } }); expect((await POST(request())).status).toBe(403)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it("allows a verified admin and returns only safe summary metadata", async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, accountId: META_AD_ACCOUNT_ID, currency: "USD" })
  })
  it("sanitizes provider errors without returning token or raw provider messages", async () => {
    state.source.mockRejectedValue(new Error("private token detail"))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, error: "meta_sync_failed" })
  })
  it("returns an actionable token-expiry reason while storing the existing safe error code", async () => {
    state.source.mockRejectedValue(new MetaSpendError("meta_authorization_failed", "meta_token_expired"))
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ ok: false, error: "meta_authorization_failed", reason: "meta_token_expired" })
    expect(state.rpc).toHaveBeenCalledWith("fail_meta_ads_spend_sync", { p_run_id: expect.any(String), p_error: "meta_authorization_failed" })
    expect(state.fx).not.toHaveBeenCalled()
    expect(state.rpc.mock.calls.some(([fn]) => fn === "commit_meta_ads_spend_sync")).toBe(false)
  })
  it("does no cron work without explicit enablement and a matching secret", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret"); vi.stubEnv("META_ADS_SPEND_CRON_ENABLED", "false")
    expect((await GET(new Request("https://preview.example/sync", { headers: { authorization: "Bearer test-secret" } }))).status).toBe(401)
    vi.stubEnv("META_ADS_SPEND_CRON_ENABLED", "true")
    expect((await GET(new Request("https://preview.example/sync"))).status).toBe(401)
    expect((await GET(new Request("https://preview.example/sync", { headers: { authorization: "Bearer test-secret" } }))).status).toBe(200)
  })
})
