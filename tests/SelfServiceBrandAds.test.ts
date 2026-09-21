import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { normalizeAdTargetUrl } from "@/lib/ads"

const root = process.cwd()
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260921123000_add_self_service_brand_ads.sql"),
  "utf8",
)
const action = fs.readFileSync(path.join(root, "app/advertise/actions.ts"), "utf8")
const callback = fs.readFileSync(path.join(root, "app/api/payments/flitt/callback/route.ts"), "utf8")
const edge = fs.readFileSync(path.join(root, "supabase/functions/flitt-callback/index.ts"), "utf8")
const dashboard = fs.readFileSync(path.join(root, "app/dashboard/ads/page.tsx"), "utf8")
const paymentResult = fs.readFileSync(path.join(root, "app/payment/result/page.tsx"), "utf8")
const hardeningMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260921153000_harden_self_service_brand_ad_finalization.sql"),
  "utf8",
)

describe("self-service Brand Ads", () => {
  it("rejects unsafe ad destination schemes", () => {
    expect(normalizeAdTargetUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeAdTargetUrl("data:text/html,hello")).toBeNull()
    expect(normalizeAdTargetUrl("file:///tmp/test")).toBeNull()
    expect(normalizeAdTargetUrl("https://user:password@example.com/shop")).toBeNull()
    expect(normalizeAdTargetUrl(`https://example.com/${"x".repeat(2048)}`)).toBeNull()
    expect(normalizeAdTargetUrl("https://example.com/shop")).toBe("https://example.com/shop")
    expect(normalizeAdTargetUrl("/seller/test-shop")).toBe("/seller/test-shop")
  })

  it("requires the authoritative Status API marker in the privileged ad finalizer", () => {
    expect(hardeningMigration).toContain("v_attempt.provider_verified_at is null")
    expect(hardeningMigration).toContain("v_attempt.provider_verification_source <> 'status_api'")
    expect(hardeningMigration).toContain("from public, anon, authenticated")
    expect(hardeningMigration).toContain("to service_role")
  })

  it("keeps migration dollar-quoting syntactically valid", () => {
    expect(migration).not.toContain("\nas $\n")
    expect(migration).not.toContain("\n$;\n")
  })

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
    expect(migration).toContain("fail_flitt_ad_payment")
    expect(action).toContain('purpose: "ad_order"')
    expect(action).toContain("createFlittCheckout")
    expect(action).toContain('formData.get("acceptAdTerms")')
    expect(callback).toContain("finalizeFlittAdPayment")
    expect(edge).toContain("finalize_flitt_ad_payment")
    expect(paymentResult).toContain("reverseFlittAdPayment(attempt.ad_order_id)")
  })

  it("prevents unpaid launch and deactivates reversed payments", () => {
    expect(migration).toContain("v_order.status <> 'paid_pending_review'")
    expect(migration).toContain("Self-service ad has not been paid and verified")
    expect(migration).toContain("status = 'reversed'")
    expect(migration).toContain("is_active = false")
  })

  it("uses owner-scoped aggregated dashboard metrics", () => {
    expect(migration).toContain("get_own_ad_event_counts")
    expect(migration).toContain('create policy "users can read own submitted ads"')
    expect(dashboard).toContain('supabase.rpc("get_own_ad_event_counts")')
    expect(dashboard).toContain("(eventCount.clicks / eventCount.impressions) * 100")
  })

  it("runs exactly the purchased duration from the selected start", () => {
    expect(migration).toContain("v_duration := make_interval(days => v_order.duration_days_snapshot)")
    expect(migration).toContain("v_end := v_start + v_duration")
    expect(migration).toContain("status = case when v_start <= v_now then 'active' else 'scheduled' end")
  })

  it("keeps paid ads moderated and auto-schedules the earliest of two homepage slots", () => {
    expect(migration).toContain("'paid_pending_review'")
    expect(migration).toContain("approve_self_service_ad")
    expect(migration).toContain("'home_hero_left'")
    expect(migration).toContain("'home_hero_right'")
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("No finite Brand Ad slot availability")
    expect(migration).toContain("ends_at is null")
  })
})
