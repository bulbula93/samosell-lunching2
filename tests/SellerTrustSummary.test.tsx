import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import SellerTrustSummary, { memberSinceLabel } from "@/components/sellers/SellerTrustSummary"

const metrics = { activeCount: 12, soldCount: 3, reviewSummary: { reviewCount: 23, averageScore: 4.8 } }
describe("seller trust summary", () => {
  it.each([false, true])("uses identical canonical metrics in profile and compact snapshot: compact=%s", (compact) => {
    render(<SellerTrustSummary metrics={metrics} verified createdAt="2026-01-01" compact={compact} />)
    expect(screen.getByText("დადასტურებული პროფილი")).toBeInTheDocument()
    expect(screen.getByText(/4.8 · 23 შეფასება/)).toBeInTheDocument()
    expect(screen.getByText("3 ნივთი")).toBeInTheDocument()
    expect(screen.getByText("12 აქტიური ნივთი")).toBeInTheDocument()
    expect(screen.getByText("SamoSell-ზე 2026 წლიდან")).toBeInTheDocument()
  })
  it("handles a new unverified seller without claiming a rating or verification", () => {
    render(<SellerTrustSummary metrics={{ activeCount: 0, soldCount: 0, reviewSummary: { reviewCount: 0, averageScore: null } }} />)
    expect(screen.queryByText("დადასტურებული პროფილი")).not.toBeInTheDocument()
    expect(screen.getByText("ჯერ შეფასებები არ აქვს")).toBeInTheDocument()
    expect(screen.getByText("ჯერ გაყიდვა არ მონიშნულა")).toBeInTheDocument()
    expect(screen.getByText("ჯერ აქტიური ნივთები არ აქვს")).toBeInTheDocument()
  })
  it("rejects missing, malformed and future membership dates", () => {
    const now = new Date("2026-10-03")
    for (const date of [null, "bad", "2027-01-01"]) expect(memberSinceLabel(date, now)).toBe("")
  })
})
