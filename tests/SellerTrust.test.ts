import { describe, expect, it } from "vitest"
import { formatSellerTenure, getSellerTrustSignals } from "@/lib/seller-trust"

const now = new Date("2026-08-31T00:00:00.000Z")

const completeProfile = {
  full_name: "Nino Seller",
  city: "თბილისი",
  avatar_url: "https://example.com/avatar.jpg",
  seller_type: "individual",
  store_logo_url: null,
  store_phone: "+995 555 12 34 56",
  created_at: "2025-02-01T00:00:00.000Z",
  is_seller_verified: false,
}

describe("seller trust signals", () => {
  it("uses factual profile, review, sold and tenure signals", () => {
    const signals = getSellerTrustSignals({
      profile: completeProfile,
      soldListingsCount: 3,
      reviewSummary: { reviewCount: 2, averageScore: 4.5 },
      now,
    })

    expect(signals.map((signal) => signal.key)).toEqual([
      "phone",
      "profile",
      "reviews",
      "sold",
      "tenure",
    ])
    expect(signals.find((signal) => signal.key === "phone")?.label).toBe("ტელეფონი მითითებულია")
    expect(signals.find((signal) => signal.key === "sold")?.label).toBe("3 გაყიდულად მონიშნული ნივთი")
    expect(signals.some((signal) => signal.key === "verified")).toBe(false)
  })

  it("only shows verified when the stored verification flag is true", () => {
    const signals = getSellerTrustSignals({
      profile: { ...completeProfile, is_seller_verified: true },
      now,
    })

    expect(signals[0]?.key).toBe("verified")
    expect(signals[0]?.label).toBe("დადასტურებული პროფილი")
  })

  it("does not claim sold activity or reviews when there is no evidence", () => {
    const signals = getSellerTrustSignals({
      profile: {
        ...completeProfile,
        full_name: "",
        avatar_url: "",
        city: "",
      },
      soldListingsCount: 0,
      reviewSummary: { reviewCount: 0, averageScore: null },
      now,
    })

    expect(signals.map((signal) => signal.key)).toEqual(["phone", "tenure"])
  })

  it("formats account tenure without accepting future dates", () => {
    expect(formatSellerTenure("2026-08-01T00:00:00.000Z", now)).toBe("1 თვეზე ნაკლები")
    expect(formatSellerTenure("2024-06-01T00:00:00.000Z", now)).toBe("2 წელი და 2 თვე")
    expect(formatSellerTenure("2027-01-01T00:00:00.000Z", now)).toBe("")
  })
})
