import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8")
}

describe("Self-service ad moderation", () => {
  it("persists rejection reason and refund state in the database", () => {
    const migration = source("supabase", "migrations", "20260928132311_add_self_service_ad_rejection_refunds.sql")
    expect(migration).toContain("reject_self_service_ad")
    expect(migration).toContain("review_status = 'rejected'")
    expect(migration).toContain("refund_status = 'pending'")
    expect(migration).toContain("rejection_reason = v_reason")
    expect(migration).toContain("v_ad.review_status <> 'pending'")
  })

  it("uses an idempotent signed Flitt reversal for a rejected paid ad", () => {
    const flitt = source("lib", "flitt.ts")
    const actions = source("app", "admin", "ads", "actions.ts")
    expect(flitt).toContain("/api/reverse/order_id")
    expect(flitt).toContain("verifyFlittSignature(reversed")
    expect(flitt).toContain("reverse_id: reverseId")
    expect(actions).toContain("reverseFlittOrder")
    expect(actions).toContain("adrej-${orderId}")
    expect(actions).toContain('rpc("reverse_flitt_ad_payment"')
  })

  it("shows approve, reject reason, refund status, and retry controls", () => {
    const admin = source("app", "admin", "ads", "page.tsx")
    const dashboard = source("app", "dashboard", "ads", "page.tsx")
    expect(admin).toContain("უარყოფა და სრული თანხის დაბრუნება")
    expect(admin).toContain("თანხის დაბრუნების ხელახლა ცდა")
    expect(admin).toContain("უარყოფის მიზეზი")
    expect(dashboard).toContain("მოდერაციის გადაწყვეტილება")
    expect(dashboard).toContain("სრული თანხის დაბრუნება")
  })
})
