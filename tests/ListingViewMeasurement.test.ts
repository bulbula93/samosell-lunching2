import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20261012110000_listing_view_daily.sql", "utf8")
const route = readFileSync("app/api/listing-view/route.ts", "utf8")
const tracker = readFileSync("components/listings/RecentlyViewedTracker.tsx", "utf8")

describe("Listing view measurement guardrails", () => {
  it("deduplicates atomically per visitor, listing and UTC day", () => {
    expect(migration).toContain("primary key (listing_id, viewer_hash, viewed_on)")
    expect(migration).toContain("on conflict do nothing")
    expect(migration).toContain("if not found then return false")
    expect(migration).toContain("set views_count=coalesce(views_count,0)+1")
  })

  it("allows only service role to invoke the counter", () => {
    expect(migration).toContain("alter table public.listing_view_daily enable row level security")
    expect(migration).toContain("alter table public.listing_view_rate_windows enable row level security")
    expect(migration).toContain("revoke all on public.listing_view_rate_windows from public, anon, authenticated")
    expect(migration).toContain("revoke all on public.listing_view_daily from public, anon, authenticated")
    expect(migration).toContain("revoke all on function public.record_distinct_listing_view(uuid,text,text) from public, anon, authenticated")
    expect(migration).toContain("grant execute on function public.record_distinct_listing_view(uuid,text,text) to service_role")
  })

  it("requires analytics consent and excludes seller/bots", () => {
    expect(route).toContain('cookieConsent(request.headers.get("cookie"))?.analytics !== true')
    expect(route).toContain('listing.status !== "active"')
    expect(route).toContain("authResponse.data.user?.id === listing.seller_id")
    expect(route).toContain('origin === new URL(request.url).origin')
    expect(route).toContain("BOT_UA.test(userAgent)")
  })

  it("identifies anonymous browsers via signed, HttpOnly cookies, never shared IPs", () => {
    expect(route).toContain('response.cookies.set(VISITOR_COOKIE')
    expect(route).toContain("timingSafeEqual")
    expect(route).toContain('createHmac("sha256", key)')
    expect(route).toContain('request.headers.get("x-vercel-forwarded-for")')
    expect(route).toContain('p_network_hash: networkHash')
    expect(migration).toContain("if v_minute_hits > 60 then return false")
    expect(migration).toContain("if v_listing_day_hits > 30 then return false")
    expect(route).not.toContain('request.headers.get("x-forwarded-for")')
  })

  it("sends views only with consent and deletes tracking cookie on revocation", () => {
    const preferences = readFileSync("lib/browser-preferences.ts", "utf8")
    expect(preferences).toContain("previouslyAllowedAnalytics && !analytics")
    expect(preferences).toContain('fetch("/api/listing-view", { method: "DELETE"')
    expect(tracker).toContain("consent?.analytics !== true")
    expect(tracker).toContain('fetch("/api/listing-view"')
    expect(tracker).toContain("NEXT_PUBLIC_PREVIEW_READ_ONLY")
  })
})
