import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { normalizeSearchId, searchListingHref } from "@/lib/search-analytics"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const migration = read(
  "supabase/migrations/20260831010000_add_search_analytics_feedback_loop.sql",
)
const catalogPage = read("app/catalog/page.tsx")
const listingPage = read("app/listing/[slug]/page.tsx")
const listingOverview = read("components/listings/ListingOverviewCard.tsx")
const productCard = read("components/listings/MarketplaceProductCard.tsx")
const favoriteAction = read("app/favorites/actions.ts")
const chatAction = read("app/dashboard/chats/actions.ts")
const adminSearchPage = read("app/admin/search/page.tsx")

describe("phase 10 search analytics feedback loop", () => {
  it("accepts only UUID search attribution and preserves clean listing links otherwise", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000"
    expect(normalizeSearchId(id)).toBe(id)
    expect(normalizeSearchId("not-a-uuid")).toBe("")
    expect(searchListingHref("prada-jacket", id)).toBe(
      `/listing/prada-jacket?search_id=${id}`,
    )
    expect(searchListingHref("prada-jacket", "bad")).toBe("/listing/prada-jacket")
  })

  it("stores privacy-minimal search impressions and conversion signals", () => {
    expect(migration).toContain("create table if not exists public.search_impressions")
    expect(migration).toContain("create table if not exists public.search_interactions")
    expect(migration).toContain("'click', 'favorite', 'chat_start'")
    expect(migration).not.toContain("ip_address")
    expect(migration).not.toContain("user_agent")
    expect(migration).not.toContain("fingerprint")
  })

  it("records search impressions and carries attribution into result clicks", () => {
    expect(catalogPage).toContain('supabase.rpc("record_search_impression"')
    expect(productCard).toContain("searchListingHref")
    expect(productCard).toContain("searchId={searchId}")
    expect(listingPage).toContain('eventType: "click"')
  })

  it("preserves attribution through favorite redirects and anonymous login", () => {
    expect(listingPage).toContain("searchId={searchId}")
    expect(listingOverview).toContain("const listingReturnPath = searchId")
    expect(listingOverview).toContain("nextPath={listingReturnPath}")
    expect(listingOverview).toContain("encodeURIComponent(listingReturnPath)")
    expect(listingOverview).toContain("searchId={searchId}")
  })

  it("records only positive downstream favorite and chat signals", () => {
    expect(favoriteAction).toContain('eventType: "favorite"')
    expect(chatAction).toContain('eventType: "chat_start"')
    expect(favoriteAction).not.toContain('eventType: "unfavorite"')
  })

  it("keeps ranking weights versioned and admin-controlled instead of auto-learning live", () => {
    expect(migration).toContain("public.search_ranking_config")
    expect(migration).toContain("public.search_ranking_config_history")
    expect(migration).toContain("public.update_search_ranking_config")
    expect(migration).toContain("admin_required")
    expect(migration).toContain("cross join config c")
  })

  it("exposes actionable admin analytics for zero results, CTR and intent", () => {
    expect(migration).toContain("public.get_search_analytics_summary")
    expect(adminSearchPage).toContain("Zero-result rate")
    expect(adminSearchPage).toContain("Search CTR")
    expect(adminSearchPage).toContain("High-intent queries")
    expect(adminSearchPage).toContain("პოზიციის CTR")
  })
})
