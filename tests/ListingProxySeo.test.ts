import { describe, expect, it } from "vitest"
import {
  canServeListingFromProxy,
  getListingSlugFromPathname,
} from "@/lib/supabase/proxy"

describe("listing proxy SEO guard", () => {
  it("targets only a single listing slug segment", () => {
    expect(getListingSlugFromPathname("/listing/asos")).toBe("asos")
    expect(getListingSlugFromPathname("/catalog")).toBeNull()
    expect(getListingSlugFromPathname("/listing/asos/images")).toBeNull()
  })

  it("serves only statuses supported by the public listing page", () => {
    expect(canServeListingFromProxy({ status: "active" })).toBe(true)
    expect(canServeListingFromProxy({ status: "reserved" })).toBe(true)
    expect(canServeListingFromProxy({ status: "sold" })).toBe(true)
    expect(canServeListingFromProxy({ status: "draft" })).toBe(false)
    expect(canServeListingFromProxy({ status: "archived" })).toBe(false)
    expect(canServeListingFromProxy(null)).toBe(false)
  })
})
