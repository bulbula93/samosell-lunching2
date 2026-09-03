import { describe, expect, it } from "vitest"
import { normalizeAdTargetUrl } from "@/lib/ads"
import { parseAdEventInput } from "@/lib/ad-tracking"

describe("ad tracking validation", () => {
  it("accepts only known placements, valid ids and internal page paths", () => {
    expect(parseAdEventInput({
      adId: "11111111-1111-4111-8111-111111111111",
      placementKey: "catalog_top_left",
      pagePath: "/catalog?category=women",
      eventType: "impression",
    })).toMatchObject({ placementKey: "catalog_top_left", eventType: "impression" })

    expect(parseAdEventInput({
      adId: "forged",
      placementKey: "admin_top",
      pagePath: "https://evil.example",
      eventType: "click",
    })).toBeNull()

    expect(parseAdEventInput({
      adId: "11111111-1111-4111-8111-111111111111",
      placementKey: "catalog_top_left",
      pagePath: "/listing/asos",
      eventType: "impression",
    })).toBeNull()
  })

  it("rejects unsafe advertiser URL protocols", () => {
    expect(normalizeAdTargetUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeAdTargetUrl("//evil.example/path")).toBeNull()
    expect(normalizeAdTargetUrl("/catalog")).toBe("/catalog")
    expect(normalizeAdTargetUrl("https://advertiser.example/")).toBe("https://advertiser.example/")
  })
})
