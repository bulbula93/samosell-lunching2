import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import MetaSpendPanel from "@/components/growth/MetaSpendPanel"
import { metaSpendDates, summarizeMetaSpend, META_AD_ACCOUNT_ID, META_AD_ACCOUNT_NAME } from "@/lib/growth/meta-spend"
import type { GrowthSummary } from "@/lib/growth/dashboard"
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const now = new Date("2026-10-07T12:00:00Z")
const growth = { counts: { registrations: 0, published_listings: 0, paying_sellers: 0, revenue: 0 }, new_sellers: 0 } as GrowthSummary
const zeroRows = () => metaSpendDates("7", now).map(date => ({ date, ad_account_id: META_AD_ACCOUNT_ID, account_name: META_AD_ACCOUNT_NAME, spend_amount: "0", spend_currency: "USD", spend_gel: "0", fx_rate_to_gel: "2.5", fx_rate_date: date, fx_source: "NBG", impressions: 0, clicks: 0, synced_at: now.toISOString() }))
describe("Meta spend dashboard states", () => {
  it("shows unavailable rather than zero when not connected and disables the unconfigured sync", () => {
    render(<MetaSpendPanel spend={summarizeMetaSpend([], "7", now)} growth={growth} configurationIssue="meta_credentials_missing" />)
    expect(screen.getByText(/Not connected/)).toBeVisible()
    expect(screen.getByRole("button", { name: "Sync Meta spend" })).toBeDisabled()
    expect(screen.queryByText("0.00 USD")).not.toBeInTheDocument()
  })
  it("shows a genuine zero report and dashes for zero-denominator costs and ROAS", () => {
    render(<MetaSpendPanel spend={summarizeMetaSpend(zeroRows(), "7", now)} growth={growth} configurationIssue={null} />)
    expect(screen.getByText("0.00 USD")).toBeVisible()
    expect(screen.getByText("0.00 GEL")).toBeVisible()
    expect(screen.getAllByText("—")).toHaveLength(5)
    expect(screen.getByText(/campaign-attributed ROAS არ არის/)).toBeVisible()
  })
  it("shows USD and explicit FX unavailable without fictional GEL ratios", () => {
    const rows = zeroRows().map(row => ({ ...row, spend_amount: "2", spend_gel: null, fx_rate_to_gel: null, fx_rate_date: null, fx_source: null }))
    render(<MetaSpendPanel spend={summarizeMetaSpend(rows, "7", now)} growth={growth} configurationIssue={null} />)
    expect(screen.getByText("14.00 USD")).toBeVisible()
    expect(screen.getByText(/FX unavailable/)).toBeVisible()
    expect(screen.getAllByText("—")).toHaveLength(6)
  })
})
