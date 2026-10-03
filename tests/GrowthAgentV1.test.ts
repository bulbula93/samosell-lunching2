import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const growthLib = readFileSync(
  join(process.cwd(), "lib", "growth-agent.ts"),
  "utf8",
)
const growthRoute = readFileSync(
  join(process.cwd(), "app", "api", "admin", "growth", "route.ts"),
  "utf8",
)
const growthPage = readFileSync(
  join(process.cwd(), "app", "admin", "growth", "page.tsx"),
  "utf8",
)
const growthClient = readFileSync(
  join(process.cwd(), "components", "admin", "GrowthAgentClient.tsx"),
  "utf8",
)

describe("Growth Agent v1", () => {
  it("tracks seller activation and supply KPIs", () => {
    expect(growthLib).toContain("ACTIVE_SELLER_LISTING_THRESHOLD = 3")
    expect(growthLib).toContain("TARGET_ACTIVE_LISTINGS = 1000")
    expect(growthLib).toContain('rpc("admin_growth_snapshot")')
    expect(growthLib).toContain("activatedSellers")
    expect(growthLib).toContain("warmSellers")
    expect(growthLib).toContain("dailyListingTarget")
  })

  it("sends aggregate growth context without direct personal fields", () => {
    expect(growthLib).toContain("aggregate marketplace metrics only")
    expect(growthLib).not.toContain('.select("id, email')
    expect(growthLib).not.toContain('.select("id, phone')
    expect(growthLib).not.toContain("full_name")
    expect(growthLib).not.toContain("username")
    expect(growthRoute).toContain("buildGrowthModelContext(snapshot)")
    expect(growthRoute).not.toContain("JSON.stringify(snapshot")
  })

  it("keeps the API admin-only and external actions approval-gated", () => {
    expect(growthRoute).toContain('requireAdminUser("/dashboard")')
    expect(growthRoute).toContain("READ-ONLY")
    expect(growthRoute).toContain("do NOT publish posts")
    expect(growthRoute).toContain("do not")
    expect(growthRoute).not.toContain(".update(")
    expect(growthRoute).not.toContain(".insert(")
    expect(growthRoute).not.toContain(".delete(")
  })

  it("exposes the dashboard and bounded conversation history", () => {
    expect(growthPage).toContain("SamoSell Growth Agent")
    expect(growthPage).toContain("TARGET 1,000 LISTINGS")
    expect(growthClient).toContain(".slice(-8)")
    expect(growthClient).toContain('fetch("/api/admin/growth"')
    expect(growthClient).toContain("AI CONNECTED")
    expect(growthClient).toContain("DETERMINISTIC FALLBACK")
  })
})
