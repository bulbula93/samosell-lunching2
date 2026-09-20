import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260920214636_tighten_payment_table_grants.sql"),
  "utf8",
)

describe("payment table least privilege", () => {
  it("removes non-read payment-table privileges from browser roles", () => {
    expect(migration).toContain("revoke truncate, references, trigger")
    expect(migration).toContain("public.flitt_payment_attempts")
    expect(migration).toContain("public.listing_boost_order_events")
    expect(migration).toContain("public.listing_boost_orders")
    expect(migration).toContain("revoke select, references, trigger")
    expect(migration).toContain("from anon")
    expect(migration).toContain("from authenticated")
  })
})
