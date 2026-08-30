import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260830140238_harden_listing_boosts.sql"),
  "utf8",
)

const finalSecurityMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260830151500_finalize_listing_boost_security.sql"),
  "utf8",
)

const boostActions = readFileSync(
  join(process.cwd(), "app", "dashboard", "boosts", "actions.ts"),
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

  it("protects promotion fields when a listing is first inserted", () => {
    expect(finalSecurityMigration).toContain("if tg_op = 'INSERT' then")
    expect(finalSecurityMigration).toContain("coalesce(new.is_vip, false) = true")
    for (const field of [
      "vip_until",
      "promoted_until",
      "featured_until",
      "featured_slot",
      "home_banner_until",
      "home_banner_slot",
    ]) {
      expect(finalSecurityMigration).toContain(`new.${field} is not null`)
    }
    expect(finalSecurityMigration).toContain("before insert or update on public.listings")
  })

  it("removes raw seller boost-order insertion and uses the trusted server client", () => {
    expect(finalSecurityMigration).toContain('drop policy if exists "sellers can create own boost orders"')
    expect(finalSecurityMigration).toContain("revoke insert on table public.listing_boost_orders from anon, authenticated")
    expect(finalSecurityMigration).toContain("grant insert on table public.listing_boost_orders to service_role")
    expect(boostActions).toContain("const trustedClient = createAdminClient()")
    expect(boostActions).toContain('trustedClient.from("listing_boost_orders").insert')
  })

  it("renews VIP MAX from active VIP MAX only and preserves longer standalone placements", () => {
    expect(finalSecurityMigration).toContain("v_combo_until timestamp with time zone")
    expect(finalSecurityMigration).toContain("o.id <> v_order.id")
    expect(finalSecurityMigration).toContain("p.placement = 'combo'")
    expect(finalSecurityMigration).toContain("v_anchor := greatest(v_now, coalesce(v_combo_until, v_now))")
    expect(finalSecurityMigration).toContain("v_listing.vip_until := greatest(coalesce(v_listing.vip_until, v_ends_at), v_ends_at)")
    expect(finalSecurityMigration).toContain("v_listing.promoted_until := greatest(coalesce(v_listing.promoted_until, v_ends_at), v_ends_at)")
    expect(finalSecurityMigration).toContain("v_listing.featured_until := greatest(coalesce(v_listing.featured_until, v_ends_at), v_ends_at)")
  })
})
