import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

function stubBaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.samosell.ge")
  vi.stubEnv("SITE_URL", "https://preview.samosell.ge")
  vi.stubEnv("FLITT_MODE", "test")
  vi.stubEnv("FLITT_MERCHANT_ID", "1549901")
  vi.stubEnv("FLITT_SECRET_KEY", "test")
  vi.stubEnv("FLITT_API_URL", "https://pay.flitt.com")
  vi.stubEnv("NEXT_PUBLIC_FLITT_PAYMENTS_ENABLED", "true")
}

beforeEach(() => {
  vi.resetModules()
  stubBaseEnv()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("Flitt signed order-status fallback", () => {
  it("accepts a signed status response and returns an approved transition", async () => {
    const { buildFlittSignature, fetchFlittOrderStatus } = await import("@/lib/flitt")
    const responseParams: Record<string, unknown> = {
      order_id: "order_status_1",
      merchant_id: 1549901,
      amount: 100,
      currency: "GEL",
      payment_id: "1014804009",
      order_status: "approved",
      response_status: "success",
    }
    responseParams.signature = buildFlittSignature(responseParams, "test")

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: responseParams }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchFlittOrderStatus({
      orderId: "order_status_1",
      amount: 100,
      currency: "GEL",
      merchantId: "1549901",
      providerPaymentId: "1014804009",
      status: "pending",
    })).resolves.toMatchObject({
      ok: true,
      nextStatus: "approved",
      paymentId: "1014804009",
      providerStatus: "approved",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://pay.flitt.com/api/status/order_id")
    const requestBody = JSON.parse(String(init.body)) as { request: Record<string, unknown> }
    expect(requestBody.request.order_id).toBe("order_status_1")
    expect(requestBody.request.merchant_id).toBe(1549901)
    expect(requestBody.request.signature).toMatch(/^[a-f0-9]{40}$/)
  })

  it("rejects an unsigned or tampered status response", async () => {
    const { fetchFlittOrderStatus } = await import("@/lib/flitt")
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: {
        order_id: "order_status_2",
        merchant_id: 1549901,
        amount: 100,
        currency: "GEL",
        payment_id: "1014804010",
        order_status: "approved",
        response_status: "success",
        signature: "0000000000000000000000000000000000000000",
      },
    }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchFlittOrderStatus({
      orderId: "order_status_2",
      amount: 100,
      currency: "GEL",
      merchantId: "1549901",
      providerPaymentId: "1014804010",
      status: "pending",
    })).rejects.toThrow("invalid_signature")
  })
})
