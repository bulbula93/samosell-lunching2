import { afterEach, describe, expect, it, vi } from "vitest"
import {
  activePromotionEndsAt,
  boostProductBenefits,
  boostProductCta,
  boostProductName,
  boostStatusLabel,
  buildBoostDurationEndsAt,
  placementLabel,
  promotionStateFromListing,
} from "@/lib/boosts"

afterEach(() => vi.useRealTimers())

describe("boost presentation and lifecycle helpers", () => {
  it("uses customer-facing Georgian package terminology", () => {
    expect(placementLabel("vip")).toBe("VIP")
    expect(placementLabel("promoted")).toBe("TOP")
    expect(placementLabel("combo")).toBe("VIP MAX")
    expect(boostProductName("legacy", "banner_home")).toBe("მთავარი გვერდის ბანერი")
    expect(boostProductCta("combo")).toBe("გააქტიურე VIP MAX")
    expect(boostProductBenefits("promoted")).toContain("TOP მონიშვნა")
  })

  it("shows stale active orders as completed", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-11T00:00:00.000Z"))
    expect(boostStatusLabel("active", "2026-09-10T00:00:00.000Z")).toBe("დასრულებული")
  })

  it("extends a renewal from the current future expiry", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"))
    expect(buildBoostDurationEndsAt("2026-09-10T00:00:00.000Z", 7)).toBe("2026-09-17T00:00:00.000Z")
  })

  it("treats every placement as active only while its timestamp is in the future", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-11T00:00:00.000Z"))
    const listing = {
      is_vip: true,
      vip_until: "2026-09-10T00:00:00.000Z",
      promoted_until: "2026-09-12T00:00:00.000Z",
      featured_until: "2026-09-13T00:00:00.000Z",
      home_banner_until: "2026-09-14T00:00:00.000Z",
    }

    const state = promotionStateFromListing(listing)
    expect(state.isVip).toBe(false)
    expect(state.isPromoted).toBe(true)
    expect(state.isFeatured).toBe(true)
    expect(state.isHomeBanner).toBe(true)
    expect(activePromotionEndsAt(listing, "combo")).toBeNull()

    const fullCombo = {
      ...listing,
      vip_until: "2026-09-15T00:00:00.000Z",
    }
    expect(activePromotionEndsAt(fullCombo, "combo")?.toISOString()).toBe("2026-09-12T00:00:00.000Z")
  })
})
