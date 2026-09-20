import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260920215755_snapshot_boost_order_terms.sql"),
  "utf8",
)

describe("boost order product-term snapshots", () => {
  it("stores placement and duration on the order and makes them immutable", () => {
    expect(migration).toContain("placement_snapshot")
    expect(migration).toContain("duration_days_snapshot")
    expect(migration).toContain("set_boost_order_product_snapshot")
    expect(migration).toContain("prevent_boost_order_terms_mutation")
    expect(migration).toContain("Boost order product terms are immutable.")
  })

  it("activates and reconciles using the purchased snapshot rather than the mutable product catalog", () => {
    expect(migration).toContain("v_placement := v_order.placement_snapshot")
    expect(migration).toContain("v_duration_days := v_order.duration_days_snapshot")
    expect(migration).toContain("where o.placement_snapshot = 'combo'")
    expect(migration).toContain("where o.placement_snapshot in ('vip', 'combo')")
    expect(migration).not.toContain("join public.listing_boost_products p on p.id = o.product_id\n  join public.listings")
  })
})
