import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Production read workload optimizations", () => {
  it("bounds the homepage catalog pool and uses an estimated count", () => {
    const source = readFileSync("lib/home-page.ts", "utf8")
    expect(source).toContain("HOME_POOL_LIMIT = 200")
    expect(source).toContain('select(HOME_LISTING_SELECT, { count: "estimated" })')
    expect(source).toContain('["home-public-data-v6"]')
    expect(source).toContain("HOME_QUERY_BUDGET_MS = PUBLIC_QUERY_TIMEOUT_MS")
  })

  it("scopes each personalized notification count to the authenticated user", () => {
    const source = readFileSync("app/api/home-personalization/route.ts", "utf8")
    const scopedCounts = source.match(/\.select\("id", \{ count: "exact", head: true \}\)\s*\.eq\("user_id", user\.id\)\s*\.is\("read_at", null\)/g)
    expect(scopedCounts).toHaveLength(2)
    expect(source).toContain('.from("favorites")')
    expect(source).toContain('.eq("user_id", user.id)')
  })
})
