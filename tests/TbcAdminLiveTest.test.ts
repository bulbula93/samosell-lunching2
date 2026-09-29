import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260929112000_add_tbc_admin_live_test_attempts.sql",
  ),
  "utf8",
)

const provider = readFileSync(
  join(process.cwd(), "lib", "tbc-admin-live-test.ts"),
  "utf8",
)

const actions = readFileSync(
  join(
    process.cwd(),
    "app",
    "admin",
    "payments",
    "tbc-live-test",
    "actions.ts",
  ),
  "utf8",
)

const page = readFileSync(
  join(
    process.cwd(),
    "app",
    "admin",
    "payments",
    "tbc-live-test",
    "page.tsx",
  ),
  "utf8",
)

const callback = readFileSync(
  join(
    process.cwd(),
    "app",
    "api",
    "tbc",
    "checkout",
    "callback",
    "route.ts",
  ),
  "utf8",
)

describe("TBC admin one-lari live test", () => {
  it("stores live-test attempts in an isolated service-only table", () => {
    expect(migration).toContain(
      "create table if not exists public.tbc_live_test_attempts",
    )
    expect(migration).toContain(
      "constraint tbc_live_test_amount_guard check (amount = 1.00)",
    )
    expect(migration).toContain(
      "constraint tbc_live_test_currency_guard check (currency = 'GEL')",
    )
    expect(migration).toContain(
      "alter table public.tbc_live_test_attempts enable row level security",
    )
    expect(migration).toContain(
      "revoke all on table public.tbc_live_test_attempts from public, anon, authenticated",
    )
    expect(migration).not.toContain(
      "grant select on table public.tbc_live_test_attempts to authenticated",
    )
  })

  it("hard-codes a real one-lari GEL payment and production URL", () => {
    expect(provider).toContain("const LIVE_TEST_AMOUNT = 1")
    expect(provider).toContain('const LIVE_TEST_CURRENCY = "GEL"')
    expect(provider).toContain(
      'siteUrl !== "https://samosell.ge"',
    )
    expect(provider).toContain('description: "SamoSell TBC live test"')
    expect(provider).toContain('preAuth: false')
    expect(provider).not.toContain("TBC_CHECKOUT_ENABLED")
  })

  it("requires admin auth for creation, sync and refund actions", () => {
    expect(actions.split('requireAdminUser("/dashboard")').length - 1).toBe(
      3,
    )
    expect(actions).toContain("createTbcAdminLiveTestPayment")
    expect(actions).toContain("syncTbcAdminLiveTestByAttemptId")
    expect(actions).toContain("cancelTbcAdminLiveTestPayment")
    expect(page).toContain("startTbcAdminLiveTestAction")
    expect(page).toContain("Refund 1 ₾")
  })

  it("lets known live-test callbacks sync while public TBC checkout remains gated", () => {
    const liveTestAt = callback.indexOf("syncTbcAdminLiveTestByPayId")
    const publicGateAt = callback.indexOf("!isTbcCheckoutEnabled()")
    const boostSyncAt = callback.indexOf("syncBoostOrderFromTbcByPayId")

    expect(liveTestAt).toBeGreaterThan(-1)
    expect(publicGateAt).toBeGreaterThan(liveTestAt)
    expect(boostSyncAt).toBeGreaterThan(publicGateAt)
    expect(callback).toContain("liveTestResult.matched")
  })

  it("never activates a listing or boost from the live-test provider module", () => {
    expect(provider).not.toContain("activateBoostOrder")
    expect(provider).not.toContain("listing_boost_orders")
    expect(provider).not.toContain("vip_until")
    expect(provider).not.toContain("promoted_until")
  })
})
