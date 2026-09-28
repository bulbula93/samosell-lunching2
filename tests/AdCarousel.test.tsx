import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("AdCarousel", () => {
  it("keeps the responsive rotating carousel contract", () => {
    const source = readFileSync(join(process.cwd(), "components", "ads", "AdCarousel.tsx"), "utf8")
    expect(source).toMatch(/ROTATION_MS\s*=\s*6000/)
    expect(source).toContain("md:grid-cols-2")
    expect(source).toContain("onTouchStart")
    expect(source).toContain("onTouchEnd")
  })

  it("counts impressions only after the ad is visible", () => {
    const source = readFileSync(join(process.cwd(), "components", "ads", "AdImpressionTracker.tsx"), "utf8")
    expect(source).toContain("IntersectionObserver")
    expect(source).toContain("intersectionRatio >= 0.5")
  })

  it("enforces ten concurrent reservations while considering scheduled campaigns", () => {
    const source = readFileSync(join(process.cwd(), "supabase", "migrations", "20260928161000_brand_ad_rotation_pool.sql"), "utf8")
    expect(source).toContain("status in ('active','scheduled')")
    expect(source).toContain(") < 10")
    expect(source).toContain("order by candidate")
  })
})
