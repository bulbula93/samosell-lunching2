import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { buildGrowthModelContext } from "@/lib/growth-agent"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

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
    const snapshot = {
      generatedAt: "2026-10-03T00:00:00Z",
      activeListings: 10,
      listings24h: 2,
      listings7d: 7,
      newProfiles24h: 1,
      newProfiles7d: 3,
      chats7d: 4,
      sold7d: 1,
      sellersWithActiveListings: 5,
      activatedSellers: 2,
      warmSellers: 3,
      singleListingSellers: 2,
      activationRatePct: 40,
      dailyListingTarget: 33,
      gapToTarget: 990,
      aiConfigured: false,
      dataHealth: { ok: true, failedSections: [] },
      signals: [],
      email: "private-seller@example.invalid",
      phone: "private-phone-sentinel",
      full_name: "private-name-sentinel",
      username: "private-username-sentinel",
    }
    const context = buildGrowthModelContext(snapshot)
    expect(context.metrics.activeListings).toBe(10)
    expect(context.metrics.activatedSellers).toBe(2)
    expect(context.privacyNote).toContain("aggregate marketplace metrics only")
    for (const field of ["email", "phone", "full_name", "username"] as const) {
      expect(context).not.toHaveProperty(field)
      expect(JSON.stringify(context)).not.toContain(snapshot[field])
    }
    expect(growthRoute).toContain("buildGrowthModelContext(snapshot)")
    expect(growthRoute).not.toContain("JSON.stringify(snapshot")
  })

  it("keeps the API admin-only and external actions approval-gated", () => {
    expect(growthRoute).toContain('requireAdminUser("/dashboard")')
    expect(growthRoute).toContain("READ-ONLY")
    expect(growthRoute).toContain("do NOT publish posts")
    expect(growthRoute).toContain("execution must pass an approval-enabled integration")
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
