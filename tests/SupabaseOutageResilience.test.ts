import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8")
}

describe("Supabase outage resilience", () => {
  it("does not prerender the homepage against a transient database outage", () => {
    const page = source("app", "page.tsx")
    expect(page).toContain('export const dynamic = "force-dynamic"')
  })

  it("uses one bounded catalog pool read for homepage product sections", () => {
    const home = source("lib", "home-page.ts")
    expect(home).toContain("HOME_POOL_LIMIT = 500")
    expect(home).toContain('select(HOME_LISTING_SELECT, { count: "exact" })')
    expect(home.match(/from\("listings_catalog"\)/g)).toHaveLength(1)
  })

  it("skips Supabase auth refresh for guest public routes", () => {
    const proxy = source("lib", "supabase", "proxy.ts")
    expect(proxy).toContain("hasSupabaseAuthCookie")
    expect(proxy).toContain("needsAuthCheck")
    expect(proxy).toContain("if (needsAuthCheck)")
  })
})
