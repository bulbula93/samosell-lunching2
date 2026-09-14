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

describe("Flitt signature", () => {
  it("hashes the exact string produced by Flitt's documented PHP/Python algorithm", async () => {
    const { buildFlittSignature } = await import("@/lib/flitt")
    const signature = buildFlittSignature({
      server_callback_url: "http://myshop/callback/",
      order_id: "TestOrder2",
      currency: "GEL",
      merchant_id: 1549901,
      order_desc: "Test payment",
      amount: 1000,
    }, "test")

    // Flitt's documentation prints this exact input string:
    // test|1000|GEL|1549901|Test payment|TestOrder2|http://myshop/callback/
    // SHA-1 of that UTF-8 string is cd0edb..., even though one published
    // example on the same page currently shows a stale/inconsistent hash.
    expect(signature).toBe("cd0edb710cbbdb6c2a4d965cdb91fdfabc343215")
  })

  it("excludes empty values, signature and response_signature_string", async () => {
    const { buildFlittSignature } = await import("@/lib/flitt")
    const base = buildFlittSignature({ amount: 100, currency: "GEL", merchant_id: 1549901 }, "test")
    const noisy = buildFlittSignature({
      amount: 100,
      currency: "GEL",
      merchant_id: 1549901,
      empty: "",
      nil: null,
      signature: "not-part-of-signature",
      response_signature_string: "masked-debug-value",
    }, "test")
    expect(noisy).toBe(base)
  })
})

describe("Flitt sandbox checkout", () => {
  it("creates a signed checkout URL without exposing the secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      response: {
        checkout_url: "https://pay.flitt.com/merchants/test/index.html?token=abc",
        payment_id: "805230052",
        response_status: "success",
      },
    }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { createFlittSandboxCheckout } = await import("@/lib/flitt")
    const result = await createFlittSandboxCheckout({ orderId: "order_1", amount: 100, currency: "GEL" })

    expect(result.paymentId).toBe("805230052")
    expect(result.checkoutUrl).toContain("https://pay.flitt.com/")
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const init = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body)) as { request: Record<string, unknown> }
    expect(body.request.merchant_id).toBe(1549901)
    expect(body.request.amount).toBe(100)
    expect(body.request.signature).toMatch(/^[a-f0-9]{40}$/)
    expect(JSON.stringify(body)).not.toContain('"test"')
  })

  it("refuses live mode even when credentials are present", async () => {
    vi.stubEnv("FLITT_MODE", "live")
    const { createFlittSandboxCheckout } = await import("@/lib/flitt")
    await expect(createFlittSandboxCheckout({ orderId: "order_2", amount: 100 })).rejects.toThrow()
  })
})

describe("Flitt callback validation", () => {
  it("accepts a valid approved callback and keeps identity checks", async () => {
    vi.stubEnv("NEXT_PUBLIC_FLITT_PAYMENTS_ENABLED", "false")
    const { buildFlittSignature, validateFlittCallback } = await import("@/lib/flitt")
    const params: Record<string, unknown> = {
      order_id: "order_3",
      merchant_id: 1549901,
      amount: "100",
      currency: "GEL",
      payment_id: "9001",
      order_status: "approved",
      response_status: "success",
    }
    params.signature = buildFlittSignature(params, "test")

    expect(validateFlittCallback(params, {
      orderId: "order_3",
      merchantId: "1549901",
      amount: 100,
      currency: "GEL",
      providerPaymentId: "9001",
      status: "pending",
    })).toMatchObject({ ok: true, nextStatus: "approved", paymentId: "9001" })
  })

  it("rejects a row created for a different merchant even if callback matches current config", async () => {
    const { buildFlittSignature, validateFlittCallback } = await import("@/lib/flitt")
    const params: Record<string, unknown> = {
      order_id: "order_merchant_drift",
      merchant_id: 1549901,
      amount: "100",
      currency: "GEL",
      payment_id: "9010",
      order_status: "approved",
      response_status: "success",
    }
    params.signature = buildFlittSignature(params, "test")

    expect(validateFlittCallback(params, {
      orderId: "order_merchant_drift",
      merchantId: "9999999",
      amount: 100,
      currency: "GEL",
      providerPaymentId: "9010",
      status: "pending",
    })).toMatchObject({ ok: false, reason: "attempt_merchant_mismatch" })
  })

  it.each([
    ["signature", "bad", "invalid_signature"],
    ["merchant_id", "999", "merchant_mismatch"],
    ["amount", "101", "amount_mismatch"],
    ["currency", "USD", "currency_mismatch"],
    ["payment_id", "other", "payment_id_mismatch"],
  ])("rejects %s mismatch", async (field, value, reason) => {
    const { buildFlittSignature, validateFlittCallback } = await import("@/lib/flitt")
    const params: Record<string, unknown> = {
      order_id: "order_4",
      merchant_id: 1549901,
      amount: "100",
      currency: "GEL",
      payment_id: "9002",
      order_status: "approved",
      response_status: "success",
    }
    if (field !== "signature") params[field] = value
    params.signature = field === "signature" ? value : buildFlittSignature(params, "test")

    expect(validateFlittCallback(params, {
      orderId: "order_4",
      merchantId: "1549901",
      amount: 100,
      currency: "GEL",
      providerPaymentId: "9002",
      status: "pending",
    })).toMatchObject({ ok: false, reason })
  })

  it("is idempotent for terminal status transitions", async () => {
    const { resolveFlittAttemptStatus } = await import("@/lib/flitt")
    expect(resolveFlittAttemptStatus("approved", "approved")).toBe("approved")
    expect(resolveFlittAttemptStatus("approved", "declined")).toBe("approved")
    expect(resolveFlittAttemptStatus("approved", "reversed")).toBe("reversed")
    expect(resolveFlittAttemptStatus("reversed", "approved")).toBe("reversed")
  })
})
