import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const prompt = read("components/pwa/PwaInstallPrompt.tsx")
const manifest = read("app/manifest.ts")
const mobileNav = read("components/layout/MobileBottomNavigation.tsx")
const globals = read("app/globals.css")
const rootLayout = read("app/layout.tsx")
const vitalsClient = read("components/shared/FieldWebVitals.tsx")
const vitalsRoute = read("app/api/web-vitals/route.ts")
const vitalsMigration = read("supabase/migrations/20260921090130_add_mobile_dimensions_to_web_vitals.sql")
const homeData = read("lib/home-page.ts")

describe("Phase 5 mobile QA and app-like polish", () => {
  it("offers contextual installation without repeatedly nagging dismissed users", () => {
    expect(prompt).toContain("beforeinstallprompt")
    expect(prompt).toContain("Add to Home Screen")
    expect(prompt).toContain("DISMISS_FOR_MS")
    expect(prompt).toContain('pathname === "/" || pathname === "/catalog"')
    expect(prompt).toContain("14 * 24 * 60 * 60 * 1000")
    expect(prompt).toContain('window.matchMedia("(display-mode: standalone)")')
  })

  it("keeps PWA shortcuts for primary mobile actions", () => {
    expect(manifest).toContain("shortcuts")
    expect(manifest).toContain('url: "/catalog"')
    expect(manifest).toContain('url: "/sell-fast"')
  })

  it("enables full safe-area viewport coverage on iPhone", () => {
    expect(rootLayout).toContain('viewportFit: "cover"')
  })

  it("compacts bottom navigation in short landscape viewports", () => {
    expect(globals).toContain("--mobile-nav-offset: 4.75rem")
    expect(globals).toContain("(orientation: landscape)")
    expect(globals).toContain("--mobile-nav-offset: 3.75rem")
    expect(mobileNav).toContain("var(--mobile-nav-offset)")
  })

  it("keeps the home page responsive when a secondary upstream query times out", () => {
    expect(homeData).toContain("HOME_QUERY_BUDGET_MS = 7000")
    expect(homeData).toContain("settleHomeQuery")
    expect(homeData).toContain("home_public_data_partial")
    expect(homeData).toContain('["home-public-data-v4"]')
    expect(homeData).not.toContain("home_public_data_failed:")
  })

  it("records viewport dimensions for phone-specific field vitals", () => {
    expect(vitalsClient).toContain('type DeviceClass = "phone" | "tablet" | "desktop"')
    expect(vitalsClient).toContain("visualViewport")
    expect(vitalsClient).toContain("Math.min(viewportWidth, viewportHeight)")
    expect(vitalsRoute).toContain("device_class: deviceClass")
    expect(vitalsRoute).toContain("viewport_width: viewportWidth")
    expect(vitalsMigration).toContain("web_vitals_events_mobile_rollup_idx")
  })
})
