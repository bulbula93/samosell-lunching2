import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const payments = readFileSync(
  join(process.cwd(), "app", "admin", "payments", "page.tsx"),
  "utf8",
)
const system = readFileSync(
  join(process.cwd(), "app", "admin", "system", "page.tsx"),
  "utf8",
)
const dashboard = readFileSync(
  join(process.cwd(), "app", "admin", "page.tsx"),
  "utf8",
)
const boosts = readFileSync(
  join(process.cwd(), "app", "admin", "boosts", "page.tsx"),
  "utf8",
)
const callback = readFileSync(
  join(process.cwd(), "app", "api", "tbc", "checkout", "callback", "route.ts"),
  "utf8",
)
const paymentActions = readFileSync(
  join(process.cwd(), "app", "admin", "payments", "actions.ts"),
  "utf8",
)

describe("Flitt-only admin payment operations", () => {
  it("uses Flitt live attempts as the admin payments source of truth", () => {
    expect(payments).toContain('from("flitt_payment_attempts")')
    expect(payments).toContain('.eq("mode", "live")')
    expect(payments).toContain("getFlittReadiness")
    expect(payments).toContain("Flitt production გადახდები")
    expect(payments).not.toContain("tbc-live-test")
    expect(payments).not.toContain("payments/readiness")
    expect(payments).not.toContain("reconcilePendingPaymentsAction")
    expect(payments).not.toContain("TBC Checkout")
  })

  it("shows only Flitt as the operational payment provider in System Status", () => {
    expect(system).toContain("Flitt production payments")
    expect(system).toContain("Payment provider:</span> Flitt")
    expect(system).not.toContain("getTbcCheckoutReadiness")
    expect(system).not.toContain("TBC Checkout")
    expect(system).not.toContain("TBC site")
  })

  it("drives payment alerts from live Flitt attempts", () => {
    expect(dashboard).toContain('from("flitt_payment_attempts")')
    expect(dashboard).toContain('.eq("mode", "live")')
    expect(dashboard).toContain("Flitt გადახდები მოლოდინში")
    expect(dashboard).toContain(
      '.or("payment_provider.neq.tbc_checkout,payment_provider.is.null")',
    )
  })

  it("removes active TBC operations from boost management", () => {
    expect(boosts).not.toContain("refreshBoostOrderStatusAction")
    expect(boosts).not.toContain("TBC status sync")
    expect(boosts).toContain(
      '.or("payment_provider.neq.tbc_checkout,payment_provider.is.null")',
    )
    expect(boosts).toContain("Flitt ავტომატური დადასტურება")
  })

  it("lets admins diagnose pending Flitt payments through the signed status API", () => {
    expect(payments).toContain("Flitt-ში სტატუსის გადამოწმება")
    expect(payments).toContain("Callback მოვიდა, მაგრამ Flitt ჯერ processing-ს აბრუნებს")
    expect(payments).toContain("Approved verification")
    expect(paymentActions).toContain("refreshFlittPaymentAttemptAction")
    expect(paymentActions).toContain("fetchFlittOrderStatus")
    expect(paymentActions).toContain('"admin_status_api"')
    expect(paymentActions).toContain("finalizeFlittBoostPayment")
    expect(paymentActions).toContain("finalizeFlittAdPayment")
    expect(paymentActions).not.toContain("FLITT_SECRET_KEY")
  })

  it("keeps the dormant TBC callback strictly disabled behind its feature gate", () => {
    const gateAt = callback.indexOf("!isTbcCheckoutEnabled()")
    const readAt = callback.indexOf("const paymentId = await readPaymentId(request)")
    expect(gateAt).toBeGreaterThan(-1)
    expect(readAt).toBeGreaterThan(gateAt)
    expect(callback).not.toContain("syncTbcAdminLiveTestByPayId")
  })
})
