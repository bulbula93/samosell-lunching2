import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const rpc = vi.hoisted(() => vi.fn())
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }))

beforeEach(() => {
  vi.resetModules()
  rpc.mockReset()
  vi.stubEnv("TBC_CHECKOUT_ENABLED", "true")
  vi.stubEnv("TBC_API_KEY", "test-api-key")
  vi.stubEnv("TBC_CLIENT_ID", "test-client-id")
  vi.stubEnv("TBC_CLIENT_SECRET", "test-client-secret")
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

const id = "11111111-1111-4111-8111-111111111111"
function claim() {
  rpc.mockResolvedValueOnce({ data: { outcome: "claimed", id, updated_at: "2026-09-07T00:00:00Z" }, error: null })
}
function response(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }) }

describe("TBC network and orchestration boundary", () => {
  it("cannot create or query payments while disabled even with credentials", async () => {
    vi.stubEnv("TBC_CHECKOUT_ENABLED", "false")
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const { createTbcPayment, getTbcPaymentDetails } = await import("@/lib/tbc")
    await expect(createTbcPayment({ orderId: id, amount: 10, currency: "GEL", description: "test" })).rejects.toThrow("disabled")
    await expect(getTbcPaymentDetails("payment")).rejects.toThrow("disabled")
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(["missing", "busy"])("does not call TBC for a %s claim", async (outcome) => {
    rpc.mockResolvedValue({ data: { outcome, id, status: "pending_payment" }, error: null })
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const { syncBoostOrderFromTbcByPayId } = await import("@/lib/tbc-sync")
    expect((await syncBoostOrderFromTbcByPayId("payment")).outcome).toBe(outcome)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([401,429,500])("HTTP %s never applies or leaks provider response", async (status) => {
    claim()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ secret: "sensitive-bank-detail" }, status)))
    const { syncBoostOrderFromTbcByPayId } = await import("@/lib/tbc-sync")
    const error = await syncBoostOrderFromTbcByPayId("payment").catch(e => e)
    expect(error.message).toContain("HTTP " + status)
    expect(error.message).not.toContain("sensitive-bank-detail")
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("timeout leaves payment unapplied and retryable", async () => {
    claim()
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")))
    const { syncBoostOrderFromTbcByPayId } = await import("@/lib/tbc-sync")
    await expect(syncBoostOrderFromTbcByPayId("payment")).rejects.toThrow()
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("malformed provider JSON does not leak the body", async () => {
    claim()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private-bank-body")))
    const { syncBoostOrderFromTbcByPayId } = await import("@/lib/tbc-sync")
    await expect(syncBoostOrderFromTbcByPayId("payment")).rejects.toThrow("invalid JSON response")
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it.each(["Created","Processing","Succeeded","Failed","Expired","Returned","PartialReturned"])("passes only safe verified %s fields to the atomic transaction", async (status) => {
    claim()
    rpc.mockResolvedValueOnce({ data: { outcome: "applied", order: { id, status: "active", provider_status: status } }, error: null })
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ access_token: "test-token" }))
      .mockResolvedValueOnce(response({ payId: "payment", status, amount: 10, currency: "GEL", cardMask: "never-store", developerMessage: "never-store" })))
    const { syncBoostOrderFromTbcByPayId } = await import("@/lib/tbc-sync")
    await syncBoostOrderFromTbcByPayId("payment", "callback")
    expect(rpc).toHaveBeenLastCalledWith("apply_verified_tbc_payment", {
      p_order_id: id, p_expected_updated_at: "2026-09-07T00:00:00Z", p_payment_id: "payment",
      p_provider_status: status, p_result_code: null, p_amount: 10, p_currency: "GEL", p_source: "callback",
    })
  })

  it("provider identity mismatch is not applied", async () => {
    claim()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ access_token: "test" }))
      .mockResolvedValueOnce(response({ payId: "different", status: "Succeeded" })))
    const { syncBoostOrderFromTbcByPayId } = await import("@/lib/tbc-sync")
    await expect(syncBoostOrderFromTbcByPayId("payment")).rejects.toThrow("identity mismatch")
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
