import { readFileSync } from "node:fs"
import { describe, expect, it, afterEach } from "vitest"
import {
  canActivateTbcBoost,
  classifyTbcHttpFailure,
  isTbcCheckoutEnabled,
  resolveTbcOrderStatus,
} from "@/lib/tbc"
import { isRefundRequestEligible, paymentOperationalState, refundStatusLabel } from "@/lib/payment-status"
import { requestProviderRefund } from "@/lib/tbc-refunds"

const envKeys = ["TBC_CHECKOUT_ENABLED", "TBC_API_KEY", "TBC_CLIENT_ID", "TBC_CLIENT_SECRET"] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe("TBC launch feature gate", () => {
  it("stays disabled when credentials exist but the explicit flag is false", () => {
    process.env.TBC_CHECKOUT_ENABLED = "false"
    process.env.TBC_API_KEY = "configured"
    process.env.TBC_CLIENT_ID = "configured"
    process.env.TBC_CLIENT_SECRET = "configured"
    expect(isTbcCheckoutEnabled()).toBe(false)
  })

  it("requires the flag and every server credential", () => {
    process.env.TBC_CHECKOUT_ENABLED = "true"
    process.env.TBC_API_KEY = "configured"
    process.env.TBC_CLIENT_ID = "configured"
    delete process.env.TBC_CLIENT_SECRET
    expect(isTbcCheckoutEnabled()).toBe(false)
    process.env.TBC_CLIENT_SECRET = "configured"
    expect(isTbcCheckoutEnabled()).toBe(true)
  })
})

describe("TBC test-only state simulation", () => {
  it.each([
    ["Created", "pending_payment"],
    ["Processing", "pending_payment"],
    ["PaymentCompletionProcessing", "pending_payment"],
    ["Succeeded", "approved"],
    ["Failed", "cancelled"],
    ["Expired", "cancelled"],
    ["Returned", "cancelled"],
    ["PartialReturned", "cancelled"],
  ])("maps %s deterministically", (providerStatus, expected) => {
    expect(resolveTbcOrderStatus("pending_payment", providerStatus)).toBe(expected)
  })

  it("does not reactivate refunded, expired or rejected orders", () => {
    for (const current of ["cancelled", "expired", "rejected"]) {
      expect(canActivateTbcBoost(current, "Succeeded")).toBe(false)
      expect(resolveTbcOrderStatus(current, "Succeeded")).toBe(current)
    }
  })

  it("does not downgrade an active order on a transient provider state", () => {
    expect(resolveTbcOrderStatus("active", "Processing")).toBe("active")
    expect(resolveTbcOrderStatus("active", "Succeeded")).toBe("active")
  })

  it.each([[401, "authentication"], [429, "rate_limited"], [500, "provider_unavailable"]] as const)(
    "classifies HTTP %s safely",
    (status, expected) => expect(classifyTbcHttpFailure(status)).toBe(expected),
  )
})

describe("refund preparation", () => {
  it("uses trusted successful TBC order state for eligibility", () => {
    expect(isRefundRequestEligible({ payment_provider: "tbc_checkout", provider_status: "Succeeded", paid_at: new Date().toISOString(), amount: 10 })).toBe(true)
    expect(isRefundRequestEligible({ payment_provider: "tbc_checkout", provider_status: "Processing", paid_at: null, amount: 10 })).toBe(false)
  })

  it("distinguishes returned and partially returned provider states", () => {
    expect(paymentOperationalState({ status: "cancelled", provider_status: "Returned" })).toBe("returned")
    expect(paymentOperationalState({ status: "cancelled", provider_status: "PartialReturned" })).toBe("partially_returned")
    expect(refundStatusLabel("approved")).toContain("ბანკის მოქმედებას ელოდება")
  })

  it("keeps the provider refund adapter deliberately non-networked", async () => {
    await expect(requestProviderRefund({ paymentId: "pay-id", amount: 10, currency: "GEL" })).resolves.toMatchObject({ ok: false, code: "not_configured" })
  })
})

describe("database and route hardening contracts", () => {
  const migration = readFileSync("supabase/migrations/20260904123127_prepare_tbc_launch_readiness.sql", "utf8")
  const callback = readFileSync("app/api/tbc/checkout/callback/route.ts", "utf8")
  const returnRoute = readFileSync("app/api/tbc/boosts/return/route.ts", "utf8")
  const sync = readFileSync("lib/tbc-sync.ts", "utf8")
  const actions = readFileSync("app/dashboard/boosts/actions.ts", "utf8")
  const cron = readFileSync("app/api/internal/tbc/reconcile/route.ts", "utf8")

  it("enforces one open refund and one event per idempotency key", () => {
    expect(migration).toContain("listing_boost_refund_one_open_per_order_idx")
    expect(migration).toContain("listing_boost_order_events_event_key_key unique (event_key)")
    expect(migration).toContain("on conflict (event_key) do nothing")
    expect(sync).toContain('"apply_verified_tbc_payment"')
  })

  it("keeps amount, currency and ownership server-authoritative", () => {
    expect(actions).toContain("amount: product.price")
    expect(actions).toContain("currency: product.currency")
    expect(actions).toContain("getOwnedListing")
    expect(migration).toContain("revoke insert, update, delete, truncate on table public.listing_boost_orders from anon, authenticated")
  })

  it("verifies callback status through TBC and scopes browser return to the owner", () => {
    expect(callback).toContain("syncBoostOrderFromTbcByPayId")
    expect(returnRoute).toContain('.eq("seller_id", user.id)')
    expect(returnRoute).toContain('getSiteUrlEnv()')
  })

  it("keeps reconciliation protected and absent from Vercel cron configuration", () => {
    expect(cron).toContain('request.headers.get("authorization") !== `Bearer ${cronSecret}`')
    expect(readFileSync("vercel.json", "utf8")).not.toContain('"crons"')
  })

  it("bounds malformed and oversized callbacks", () => {
    expect(callback).toContain("MAX_CALLBACK_BYTES")
    expect(callback).toContain("PAYMENT_ID_PATTERN")
    expect(callback).toContain("413")
  })
})
