import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import AdCarousel from "@/components/ads/AdCarousel"
import {
  createAdSchedule,
  HOME_AD_SEATS,
  isHomeAdPlacement,
  PAID_ADS_HOME_VIEWS_THRESHOLD,
  parseAdminAdDurationDays,
} from "@/lib/admin-ads"
import type { AdRecord } from "@/lib/ads"
import { firstFreeVipErrorFlash, isFirstFreeVipEnabled, paymentMethodLabel } from "@/lib/boosts"

vi.mock("@/components/ads/AdImpressionTracker", () => ({ default: () => null }))

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8")
const MIGRATION = read("supabase", "migrations", "20261106090000_growth_pricing_launch_phase.sql")

describe("free first VIP (launch promotion)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is on by default and can be switched off by env", () => {
    expect(isFirstFreeVipEnabled()).toBe(true)
    vi.stubEnv("FIRST_FREE_VIP_ENABLED", "false")
    expect(isFirstFreeVipEnabled()).toBe(false)
  })

  it("labels the promotional order and maps RPC errors to flashes", () => {
    expect(paymentMethodLabel("promo_first_vip")).toBe("უფასო პირველი VIP")
    expect(firstFreeVipErrorFlash("promo_already_used")).toBe("free_vip_used")
    expect(firstFreeVipErrorFlash("listing_not_active")).toBe("free_vip_listing_inactive")
    expect(firstFreeVipErrorFlash("listing_not_found")).toBe("not_found")
    expect(firstFreeVipErrorFlash("promo_unavailable")).toBe("free_vip_unavailable")
    expect(firstFreeVipErrorFlash("boom")).toBe("free_vip_failed")
  })

  it("is enforced in the database: free, VIP-only, once per seller, trusted activation", () => {
    expect(MIGRATION).toContain("'promo_first_vip'")
    expect(MIGRATION).toContain("check (payment_method is distinct from 'promo_first_vip' or (amount = 0 and product_id = 'vip_7d'))")
    expect(MIGRATION).toMatch(/create unique index if not exists listing_boost_orders_one_free_vip_per_seller\s+on public\.listing_boost_orders \(seller_id\)\s+where payment_method = 'promo_first_vip'/)
    expect(MIGRATION).toContain("elsif p_activation_source = 'promo' then")
    expect(MIGRATION).toContain("v_order.payment_method is distinct from 'promo_first_vip'")
    expect(MIGRATION).toContain("revoke all on function public.activate_listing_boost_order(uuid,uuid,integer,text) from public, anon, authenticated;")
    expect(MIGRATION).toContain("revoke all on function public.claim_first_free_vip(uuid) from public, anon;")
    expect(MIGRATION).toContain("grant execute on function public.claim_first_free_vip(uuid) to authenticated;")
    expect(MIGRATION).toContain("if v_listing.status <> 'active' then")
    expect(MIGRATION).toContain("v_listing.seller_id <> v_uid")
  })

  it("is offered on the promote page and advertised on seller entry points", () => {
    const promote = read("app", "dashboard", "listings", "[id]", "promote", "page.tsx")
    expect(promote).toContain("claimFirstFreeVipAction")
    expect(promote).toContain('.eq("payment_method", "promo_first_vip")')
    expect(promote).toContain('listing.status === "active"')
    expect(read("components", "dashboard", "ListingManagementCard.tsx")).toContain("პირველი უფასოა")
    expect(read("components", "dashboard", "CreateListingWizard.tsx")).toContain("პირველი უფასოა")
  })
})

describe("partner banner programme and home ad seats", () => {
  it("lets admins run partner campaigns for 7 or 14 days only", () => {
    expect(parseAdminAdDurationDays("14")).toBe(14)
    expect(parseAdminAdDurationDays("7")).toBe(7)
    expect(parseAdminAdDurationDays("30")).toBe(7)
    expect(parseAdminAdDurationDays(null)).toBe(7)
    const schedule = createAdSchedule(14, new Date("2026-11-06T10:00:00Z"))
    expect(schedule).toEqual({ startsAt: "2026-11-06T10:00:00.000Z", endsAt: "2026-11-20T10:00:00.000Z" })
  })

  it("shares three seats between paid and admin home ads", () => {
    expect(HOME_AD_SEATS).toBe(3)
    expect(isHomeAdPlacement("home_hero_left")).toBe(true)
    expect(isHomeAdPlacement("catalog_top_left")).toBe(false)
    const actions = read("app", "admin", "ads", "actions.ts")
    expect(actions).toContain('adminAdsRedirect("home_full", adId)')
    expect(actions).toContain('.is("submitted_by", null)')
    // Paid approvals count admin home ads too.
    expect(MIGRATION).toMatch(/select a\.ends_at from public\.ads a\s+where a\.submitted_by is null and a\.is_active/)
    expect(MIGRATION).toContain(") < 3")
  })

  it("shows at most three campaigns even if more are live", () => {
    const ad = (id: string, priority: number): AdRecord => ({
      id, placement_key: "home_hero_left", title: `ad-${id}`, description: null, image_url: null,
      target_url: "https://example.com", is_active: true, starts_at: null, ends_at: null, priority,
      advertiser_name: null, created_at: "2026-11-01T00:00:00Z",
    })
    render(<AdCarousel ads={[ad("a", 0), ad("b", 5), ad("c", 0), ad("d", 9)]} pagePath="/" />)
    expect(screen.getAllByRole("button", { name: /^რეკლამა \d \/ 3$/ })).toHaveLength(3)
  })
})

describe("paid ads paused until traffic justifies a price", () => {
  it("pauses the paid product and shows the partner programme on /advertise", () => {
    expect(MIGRATION).toContain("update public.ad_products set is_active = false")
    const page = read("app", "advertise", "page.tsx")
    expect(page).toContain("data-partner-program")
    expect(page).toContain("14 დღე უფასოდ")
    expect(page).toContain('href="/contact"')
  })

  it("tracks the re-pricing threshold for admins", () => {
    expect(PAID_ADS_HOME_VIEWS_THRESHOLD).toBe(2000)
    const admin = read("app", "admin", "ads", "page.tsx")
    expect(admin).toContain("data-paid-ads-threshold")
    expect(admin).toContain('.eq("event_name", "page_view")')
    expect(admin).toContain('.eq("path", "/")')
    expect(admin).toContain("CTR")
  })
})
