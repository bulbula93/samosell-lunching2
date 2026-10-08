import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { growthExport } from "@/lib/growth/export"
import type { GrowthSummary } from "@/lib/growth/dashboard"
import { summarizeMetaSpend, type MetaSpendSummary } from "@/lib/growth/meta-spend"
import GrowthExportButtons from "@/components/growth/GrowthExportButtons"
const at = "2026-10-08T22:30:00Z"
const growth: GrowthSummary = {
  counts: { visitors: 20, sessions: 22, page_views: 40, registrations: 2, listing_starts: 3, published_listings: 2, sellers: 1, purchases: 0, revenue: 0, paying_sellers: 0, banner_purchases: 0, publish_failures: 1, boosted_published_listings: 0 },
  funnel: [20, 2, 1, 1, 0], sources: [{ label: '=HYPERLINK("bad")', visitors: 2, page_views: 4 }], campaigns: [{ label: 'ქართული, კამპანია', visitors: 2, page_views: 4 }], new_sellers: 1, registered_publishers: 1, favorites_added: 1, chats_initiated: 0, coverage_since: "2026-10-07T12:00:00Z",
}
const spend: MetaSpendSummary = { status: "ready", spendUsd: 3, spendGel: 8, fxStatus: "available", syncedAt: at, daysCovered: 1, daysExpected: 1, stale: false, lastError: null, dailySpend: [{ date: "2026-10-09", usd: 3, gel: 8 }] }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe("Growth aggregate exports", () => {
  it("uses Tbilisi boundaries, includes all activity and attribution, and separates cohort conversions", () => {
    const report = growthExport(growth, spend, "today", at)
    expect(report.text).toContain("From (inclusive, UTC): 2026-10-08T20:00:00.000Z")
    expect(report.text).toContain("Snapshot generated (UTC): " + at)
    expect(report.text).toContain("Registration → Published: 50.0%")
    expect(report.text).toContain("Listing Published · conversion: 100.0%")
    expect(report.text).toContain("Cost per Registration · GEL: 4.00")
    expect(report.text).toContain("Paying Seller CAC · GEL: unavailable")
    expect(report.text).toContain("Blended ROAS: 0.00")
    expect(report.text).toContain("publish_failures: 1")
    expect(report.text).toContain("ქართული, კამპანია")
    expect(report.text).toContain("2026-10-09 · GEL: 8.00")
    expect(report.text).not.toMatch(/user_id|email|token|session_id/)
  })
  it("does not export failed/stale costs or invent zeros for missing backend data", () => {
    for (const flags of [{ stale: true }, { lastError: "meta_authorization_failed" }]) {
      const report = growthExport(growth, { ...spend, ...flags }, "7", at)
      expect(report.text).toContain("Spend GEL: 8.00")
      expect(report.text).toContain("Cost per Registration · GEL: unavailable")
      expect(report.text).toContain("Blended ROAS: unavailable")
    }
    const report = growthExport(null, summarizeMetaSpend([], "30", new Date(at)), "30", at, "Backend unavailable")
    expect(report.text).toContain("Reason: Backend unavailable")
    expect(report.text).toContain("Spend USD: unavailable")
    expect(report.text).not.toContain("visitors: 0")
  })
  it("writes Unicode Excel CSV with safe quoted campaign labels and formula neutralization", () => {
    const report = growthExport(growth, spend, "today", at)
    expect(report.csv.startsWith('\uFEFF"Section","Metric","Value"\r\n')).toBe(true)
    expect(report.csv).toContain('"\'=HYPERLINK(""bad"") · visitors"')
    expect(report.csv).toContain('"ქართული, კამპანია · visitors"')
    expect(report.filename).toMatch(/^samosell-growth-1d-2026-10-09\.csv$/)
  })
  it("copies the displayed snapshot and provides manual fallback when clipboard is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"))
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    render(<GrowthExportButtons text="Snapshot" csv="CSV" filename="report.csv" />)
    fireEvent.click(screen.getByRole("button", { name: "ანგარიშის კოპირება" }))
    expect(await screen.findByRole("textbox")).toHaveValue("Snapshot")
    writeText.mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole("button", { name: "ანგარიშის კოპირება" }))
    expect(await screen.findByText(/ანგარიში დაკოპირებულია/)).toBeVisible()
    expect(writeText).toHaveBeenCalledWith("Snapshot")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })
  it("downloads a local CSV and revokes its temporary URL", async () => {
    const createObjectURL = vi.fn(() => "blob:report")
    const revokeObjectURL = vi.fn()
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    render(<GrowthExportButtons text="Snapshot" csv="CSV" filename="report.csv" />)
    fireEvent.click(screen.getByRole("button", { name: "CSV ჩამოტვირთვა" }))
    expect(click).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(await screen.findByText(/CSV ჩამოტვირთვა დაწყებულია/)).toBeVisible()
    await vi.waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:report"), { timeout: 2000 })
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
