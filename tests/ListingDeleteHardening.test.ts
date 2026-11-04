import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const actions = readFileSync("app/dashboard/listings/actions.ts", "utf8")
const rateLimit = readFileSync("lib/rate-limit.ts", "utf8")
const migration = readFileSync(
  "supabase/migrations/20260901091000_rate_limit_listing_deletes.sql",
  "utf8",
)
const paymentHistoryMigration = readFileSync(
  "supabase/migrations/20261104122125_fix_listing_delete_payment_history.sql",
  "utf8",
)
const listingsPage = readFileSync("app/dashboard/listings/page.tsx", "utf8")

describe("listing deletion integrity", () => {
  it("deletes the owned database row before best-effort storage cleanup", () => {
    const databaseDelete = actions.indexOf('.from("listings").delete()')
    const storageCleanup = actions.indexOf('.storage.from("listing-images").remove(storagePaths)')
    expect(databaseDelete).toBeGreaterThan(-1)
    expect(storageCleanup).toBeGreaterThan(databaseDelete)
    expect(actions).toContain('console.error("listing_storage_cleanup_failed"')
  })

  it("rate limits destructive requests with a fixed database rule", () => {
    expect(actions).toContain('enforceRateLimit(supabase, "listing_delete")')
    expect(rateLimit).toContain("listing_delete")
    expect(migration).toContain("p_action = 'listing_delete'")
    expect(migration).toContain("p_max_hits = 6")
  })

  it("blocks hard deletion only for listings with an actual paid boost order", () => {
    expect(actions).toContain('.not("paid_at", "is", null)')
    expect(paymentHistoryMigration).toContain("o.paid_at is not null")
  })

  it("shows stable user-facing feedback when deletion fails", () => {
    expect(listingsPage).toContain('case "rate_limited"')
    expect(listingsPage).toContain('case "error"')
    expect(actions).toContain('console.error("listing_delete_database_failed"')
  })
})
