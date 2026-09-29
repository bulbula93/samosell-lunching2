import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const adminSource = readFileSync(
  join(process.cwd(), "app", "admin", "page.tsx"),
  "utf8",
)

const systemSource = readFileSync(
  join(process.cwd(), "app", "admin", "system", "page.tsx"),
  "utf8",
)

describe("admin phase 2 operations", () => {
  it("adds actionable operational alerts to the dashboard", () => {
    expect(adminSource).toContain("operationalAlerts")
    expect(adminSource).toContain("24სთ+ მოდერაციის backlog")
    expect(adminSource).toContain("წარუმატებელი გადახდები")
    expect(adminSource).toContain("Flitt stale გადახდები")
    expect(adminSource).toContain("რეკლამები განხილვისთვის")
    expect(adminSource).toContain("არასრულად შევსებული მაღაზიები")
  })

  it("includes Story reports in dashboard moderation totals", () => {
    expect(adminSource).toContain('from("story_reports")')
    expect(adminSource).toContain("openStoryReports")
    expect(adminSource).toContain("reviewingStoryReports")
  })

  it("adds a system status route without exposing secret values", () => {
    expect(adminSource).toContain('href="/admin/system"')
    expect(systemSource).toContain("getFlittReadiness")
    expect(systemSource).toContain("Flitt production payments")
    expect(systemSource).not.toContain("getTbcCheckoutReadiness")
    expect(systemSource).toContain("envPresent")
    expect(systemSource).not.toContain("process.env.RESEND_API_KEY")
    expect(systemSource).not.toContain("process.env.FLITT_SECRET_KEY")
    expect(systemSource).not.toContain("TBC Checkout")
  })

  it("keeps support architecture visible in system status as it evolves", () => {
    expect(systemSource).toContain("Support ticketing")
    expect(systemSource).toContain("DB ticketing + email")
    expect(systemSource).toContain("email notification")
  })
})
