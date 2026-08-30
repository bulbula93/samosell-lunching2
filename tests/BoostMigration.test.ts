import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260830140238_harden_listing_boosts.sql"),
  "utf8",
)

describe("hardened listing boosts migration", () => {
  it("blocks ordinary clients from changing every promotion field", () => {
    expect(migration).toContain("private.protect_listing_promotion_fields")
    for (const field of [
      "is_vip",
      "vip_until",
      "promoted_until",
      "featured_until",
      "featured_slot",
      "home_banner_until",
      "home_banner_slot",
    ]) {
      expect(migration).toContain(`new.${field} is distinct from old.${field}`)
    }
    expect(migration).toContain("errcode = '42501'")
  })

  it("exposes activation only to service_role and verifies TBC success", () => {
    expect(migration).toContain("public.activate_listing_boost_order")
    expect(migration).toContain("security definer")
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain("v_listing.seller_id <> v_order.seller_id")
    expect(migration).toContain("v_order.provider_status <> 'Succeeded'")
    expect(migration).toContain("grant execute on function public.activate_listing_boost_order(uuid, uuid, integer, text) to service_role")
    expect(migration).toContain("revoke all on function public.activate_listing_boost_order(uuid, uuid, integer, text) from public, anon, authenticated")
  })

  it("makes activation idempotent and extends from a future end date", () => {
    expect(migration).toContain("for update")
    expect(migration).toContain("v_order.status = 'active' and v_order.ends_at > v_now")
    expect(migration).toContain("'activated', false")
    expect(migration).toContain("v_anchor := greatest(v_now, v_listing.vip_until)")
    expect(migration).toContain("v_anchor + make_interval(days => v_product.duration_days)")
  })

  it("expires centrally, reconciles overlaps, and schedules the job", () => {
    expect(migration).toContain("public.reconcile_expired_listing_boosts")
    expect(migration).toContain("set status = 'expired'")
    expect(migration).toContain("private.reconcile_listing_boost_state")
    expect(migration).toContain("and o.ends_at > now()")
    expect(migration).toContain("'reconcile-listing-boosts'")
    expect(migration).toContain("'*/5 * * * *'")
  })

  it("keeps only the four requested products active", () => {
    for (const product of ["vip_7d", "promoted_7d", "combo_7d", "home_banner_7d"]) {
      expect(migration).toContain(product)
    }
    expect(migration).toContain("when id = 'featured_home_7d' then false")
    expect(migration).toContain("when 'vip_7d' then 9.90")
    expect(migration).toContain("when 'promoted_7d' then 14.90")
    expect(migration).toContain("when 'combo_7d' then 34.90")
    expect(migration).toContain("when 'home_banner_7d' then 39.90")
  })
})
