import { describe, expect, it, vi } from "vitest"
import {
  buildFlittSignature,
  processFlittCallback,
  readFlittRuntimeConfig,
  type FlittAttempt,
  type FlittRuntimeConfig,
} from "@/supabase/functions/flitt-callback/verification"

const fixtureSecret = "unit-test-only-signing-key"
const fixtureMerchantId = "424242"
const config: FlittRuntimeConfig = {
  mode: "test",
  merchantId: fixtureMerchantId,
  secretKey: fixtureSecret,
  apiUrl: "https://sandbox-payments.invalid",
}

const baseAttempt: FlittAttempt = {
  orderId: "security-order-1",
  boostOrderId: "11111111-1111-4111-8111-111111111111",
  amount: 990,
  currency: "GEL",
  merchantId: fixtureMerchantId,
  providerPaymentId: "provider-payment-1",
  providerVerifiedAt: null,
  providerVerificationSource: null,
  status: "pending",
  purpose: "boost_order",
}

async function signedCallback(overrides: Record<string, unknown> = {}) {
  const params: Record<string, unknown> = {
    order_id: baseAttempt.orderId,
    merchant_id: fixtureMerchantId,
    amount: baseAttempt.amount,
    currency: baseAttempt.currency,
    payment_id: baseAttempt.providerPaymentId,
    order_status: "approved",
    response_status: "success",
    ...overrides,
  }
  params.signature = await buildFlittSignature(params, fixtureSecret)
  return params
}

async function signedStatus(overrides: Record<string, unknown> = {}, signingKey = fixtureSecret) {
  const params: Record<string, unknown> = {
    order_id: baseAttempt.orderId,
    merchant_id: fixtureMerchantId,
    amount: baseAttempt.amount,
    currency: baseAttempt.currency,
    payment_id: baseAttempt.providerPaymentId,
    order_status: "approved",
    response_status: "success",
    ...overrides,
  }
  params.signature = await buildFlittSignature(params, signingKey)
  return params
}

function statusFetch(params: Record<string, unknown>) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ response: params }), { status: 200 }))
}

function dependencies(fetchImpl: typeof fetch) {
  return {
    fetchImpl,
    persist: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
    reverse: vi.fn().mockResolvedValue(undefined),
  }
}

describe("Flitt Edge callback authoritative verification", () => {
  it("fails closed when required runtime configuration is absent or live", () => {
    expect(() => readFlittRuntimeConfig(() => undefined)).toThrowError("flitt_configuration_missing")
    expect(() => readFlittRuntimeConfig((name) => ({
      FLITT_MODE: "live",
      FLITT_MERCHANT_ID: fixtureMerchantId,
      FLITT_SECRET_KEY: fixtureSecret,
      FLITT_API_URL: config.apiUrl,
    }[name]))).toThrowError("flitt_mode_not_test")
  })

  it("does not activate for a signed callback claiming approved when provider status is pending", async () => {
    const deps = dependencies(statusFetch(await signedStatus({ order_status: "processing" })))
    await expect(processFlittCallback(await signedCallback(), baseAttempt, config, deps)).resolves.toMatchObject({
      approved: false,
      nextStatus: "pending",
    })
    expect(deps.persist).toHaveBeenCalledWith(expect.objectContaining({ nextStatus: "pending" }))
    expect(deps.finalize).not.toHaveBeenCalled()
  })

  it("does not activate when the provider status is declined", async () => {
    const deps = dependencies(statusFetch(await signedStatus({ order_status: "declined" })))
    await expect(processFlittCallback(await signedCallback(), baseAttempt, config, deps)).resolves.toMatchObject({
      approved: false,
      nextStatus: "declined",
    })
    expect(deps.finalize).not.toHaveBeenCalled()
  })

  it.each([
    ["amount mismatch", { amount: baseAttempt.amount + 1 }, "amount_mismatch"],
    ["payment id mismatch", { payment_id: "different-payment" }, "payment_id_mismatch"],
    ["merchant mismatch", { merchant_id: "999999" }, "merchant_mismatch"],
  ])("rejects provider %s without finalization", async (_label, overrides, code) => {
    const deps = dependencies(statusFetch(await signedStatus(overrides)))
    await expect(processFlittCallback(await signedCallback(), baseAttempt, config, deps)).rejects.toMatchObject({ code })
    expect(deps.persist).not.toHaveBeenCalled()
    expect(deps.finalize).not.toHaveBeenCalled()
  })

  it("rejects an invalid provider response signature without finalization", async () => {
    const deps = dependencies(statusFetch(await signedStatus({}, "different-unit-test-key")))
    await expect(processFlittCallback(await signedCallback(), baseAttempt, config, deps)).rejects.toMatchObject({
      code: "invalid_status_signature",
    })
    expect(deps.persist).not.toHaveBeenCalled()
    expect(deps.finalize).not.toHaveBeenCalled()
  })

  it("fails closed when the provider status API is unavailable", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("network unavailable"))
    const deps = dependencies(fetchImpl)
    await expect(processFlittCallback(await signedCallback(), baseAttempt, config, deps)).rejects.toMatchObject({
      code: "status_api_unavailable",
    })
    expect(deps.persist).not.toHaveBeenCalled()
    expect(deps.finalize).not.toHaveBeenCalled()
  })

  it("persists approval and finalizes only after an independently signed approved status", async () => {
    const deps = dependencies(statusFetch(await signedStatus()))
    await expect(processFlittCallback(await signedCallback(), baseAttempt, config, deps)).resolves.toMatchObject({
      approved: true,
      nextStatus: "approved",
    })
    expect(deps.persist).toHaveBeenCalledTimes(1)
    expect(deps.finalize).toHaveBeenCalledTimes(1)
    expect(deps.finalize).toHaveBeenCalledWith(baseAttempt.boostOrderId)
  })

  it("retries idempotent finalization for a duplicate provider-verified callback", async () => {
    const deps = dependencies(statusFetch(await signedStatus()))
    await processFlittCallback(await signedCallback(), baseAttempt, config, deps)
    await processFlittCallback(await signedCallback(), {
      ...baseAttempt,
      status: "approved",
      providerVerifiedAt: "2026-09-14T16:00:00.000Z",
      providerVerificationSource: "status_api",
    }, config, deps)

    expect(deps.persist).toHaveBeenCalledTimes(2)
    expect(deps.finalize).toHaveBeenCalledTimes(2)
  })

  it("retries finalization after approval persistence succeeded but finalization failed", async () => {
    const fetchImpl = statusFetch(await signedStatus())
    const first = dependencies(fetchImpl)
    first.finalize.mockRejectedValueOnce(new Error("transient database failure"))

    await expect(processFlittCallback(await signedCallback(), baseAttempt, config, first)).rejects.toThrow(
      "transient database failure",
    )
    expect(first.persist).toHaveBeenCalledTimes(1)
    expect(first.finalize).toHaveBeenCalledTimes(1)

    const retry = dependencies(fetchImpl)
    await expect(processFlittCallback(await signedCallback(), {
      ...baseAttempt,
      status: "approved",
      providerVerifiedAt: "2026-09-15T09:00:00.000Z",
      providerVerificationSource: "status_api",
    }, config, retry)).resolves.toMatchObject({ approved: true })
    expect(retry.finalize).toHaveBeenCalledTimes(1)
  })

  it("reconciles every authoritative reversed boost callback", async () => {
    const deps = dependencies(statusFetch(await signedStatus({ order_status: "reversed" })))
    await expect(processFlittCallback(await signedCallback(), {
      ...baseAttempt,
      status: "approved",
      providerVerifiedAt: "2026-09-15T09:00:00.000Z",
      providerVerificationSource: "status_api",
    }, config, deps)).resolves.toMatchObject({ nextStatus: "reversed", approved: false })
    expect(deps.persist).toHaveBeenCalledWith(expect.objectContaining({ nextStatus: "reversed" }))
    expect(deps.reverse).toHaveBeenCalledTimes(1)
    expect(deps.reverse).toHaveBeenCalledWith(baseAttempt.boostOrderId)
    expect(deps.finalize).not.toHaveBeenCalled()
  })

  it("retries reversal reconciliation and isolates non-boost sandbox payments", async () => {
    const fetchImpl = statusFetch(await signedStatus({ order_status: "reversed" }))
    const boostDeps = dependencies(fetchImpl)
    const reversedAttempt = { ...baseAttempt, status: "reversed" as const }
    await processFlittCallback(await signedCallback(), reversedAttempt, config, boostDeps)
    await processFlittCallback(await signedCallback(), reversedAttempt, config, boostDeps)
    expect(boostDeps.reverse).toHaveBeenCalledTimes(2)

    const sandboxDeps = dependencies(fetchImpl)
    await processFlittCallback(await signedCallback(), {
      ...reversedAttempt,
      purpose: "sandbox_test",
      boostOrderId: null,
    }, config, sandboxDeps)
    expect(sandboxDeps.reverse).not.toHaveBeenCalled()
  })

  it("keeps reversed status terminal and never reactivates it", async () => {
    const reversedAttempt: FlittAttempt = {
      ...baseAttempt,
      status: "reversed",
      providerVerifiedAt: "2026-09-14T16:00:00.000Z",
      providerVerificationSource: "status_api",
    }
    const deps = dependencies(statusFetch(await signedStatus({ order_status: "approved" })))
    await expect(processFlittCallback(await signedCallback(), reversedAttempt, config, deps)).resolves.toMatchObject({
      approved: false,
      nextStatus: "reversed",
    })
    expect(deps.finalize).not.toHaveBeenCalled()
    expect(deps.reverse).toHaveBeenCalledTimes(1)
  })
})
