import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8")
}

describe("Supabase outage resilience", () => {
  it("uses ISR and lets a failed regeneration preserve the last good homepage", () => {
    const page = source("app", "page.tsx")
    expect(page).toContain('export const revalidate = 60')
    expect(page).not.toContain('export const dynamic = "force-dynamic"')
    expect(page).not.toContain("Promise.allSettled")
  })

  it("keeps the homepage header inside the private client personalization provider", () => {
    const page = source("app", "page.tsx")
    expect(page).toContain('import HomeSiteHeader from "@/components/home/HomeSiteHeader"')
    expect(page.indexOf("<HomePersonalizationProvider>")).toBeLessThan(page.indexOf("<HomeSiteHeader"))
    expect(page).not.toContain("<SiteHeader />")
  })

  it("uses one bounded catalog pool read for homepage product sections", () => {
    const home = source("lib", "home-page.ts")
    expect(home).toContain("HOME_POOL_LIMIT = 500")
    expect(home).toContain('select(HOME_LISTING_SELECT, { count: "exact" })')
    expect(home.match(/from\("listings_catalog"\)/g)).toHaveLength(2)
    expect(home).toContain("home_public_data_retry")
    // Retry eligibility and rejected transports are exercised behaviorally in
    // HomeCpuResilience.test.ts; do not couple them to an exact if expression.
  })

  it("skips Supabase auth refresh for guest public routes", () => {
    const proxy = source("lib", "supabase", "proxy.ts")
    expect(proxy).toContain("hasSupabaseAuthCookie")
    expect(proxy).toContain("needsAuthCheck")
    expect(proxy).toContain("if (needsAuthCheck)")
  })

  it("keeps Proxy enabled while bypassing session refresh only for public homepage reads", () => {
    const rootProxy = source("proxy.ts")
    const sessionProxy = source("lib", "supabase", "proxy.ts")
    expect(rootProxy).toContain("(?!_next/static")
    expect(sessionProxy).toContain('pathname === "/" && (request.method === "GET" || request.method === "HEAD")')
  })
})
