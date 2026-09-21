import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260921123000_add_self_service_brand_ads.sql"),
  "utf8",
)
const action = fs.readFileSync(path.join(root, "app/advertise/actions.ts"), "utf8")
const callback = fs.readFileSync(path.join(root, "app/api/payments/flitt/callback/route.ts"), "utf8")
const edge = fs.readFileSync(path.join(root, "supabase/functions/flitt-callback/index.ts"), "utf8")

describe("self-service Brand Ads", () => {
  it("defines the paid 7-day ad product and own-order RLS", () => {
    expect(migration).toContain("'home_brand_ad_7d'")
    expect(migration).toContain("49.90")
    expect(migration).toContain("duration_days")
    expect(migration).toContain("users can read own ad orders")
    expect(migration).toContain("user_id = (select auth.uid())")
  })

  it("binds Brand Ad orders to independently verified Flitt attempts", () => {
    expect(migration).toContain("ad_order_id")
    expect(migration).toContain("'ad_order'")
    expect(migration).toContain("finalize_flitt_ad_payment")
    expect(migration).toContain("reverse_flitt_ad_payment")
    expect(action).toContain('purpose: "ad_order"')
    expect(action).toContain("createFlittCheckout")
    expect(callback).toContain("finalizeFlittAdPayment")
    expect(edge).toContain("finalize_flitt_ad_payment")
  })

  it("keeps paid ads moderated and auto-schedules the earliest of two homepage slots", () => {
    expect(migration).toContain("'paid_pending_review'")
    expect(migration).toContain("approve_self_service_ad")
    expect(migration).toContain("'home_hero_left'")
    expect(migration).toContain("'home_hero_right'")
    expect(migration).toContain("pg_advisory_xact_lock")
  })
})
