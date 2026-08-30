import { describe, expect, it } from "vitest"
import { getProfileCompletion } from "@/lib/profile-completion"

describe("profile completion", () => {
  it("scores four core profile fields equally", () => {
    const completion = getProfileCompletion({
      full_name: "Giorgi",
      city: "თბილისი",
      avatar_url: "https://example.com/avatar.jpg",
      store_phone: "",
    })

    expect(completion.percentage).toBe(75)
    expect(completion.completedCount).toBe(3)
    expect(completion.missing.map((item) => item.key)).toEqual(["phone"])
    expect(completion.canPublishListing).toBe(false)
  })

  it("allows listing publication when only optional completion fields are missing", () => {
    const completion = getProfileCompletion({
      store_phone: "+995 555 12 34 56",
    })

    expect(completion.percentage).toBe(25)
    expect(completion.canPublishListing).toBe(true)
    expect(completion.blockingMissing).toEqual([])
  })

  it("accepts a store logo as the public-facing profile photo", () => {
    const completion = getProfileCompletion({
      seller_type: "store",
      store_logo_url: "https://example.com/logo.jpg",
      store_phone: "+995555123456",
    })

    expect(completion.items.find((item) => item.key === "photo")?.complete).toBe(true)
    expect(completion.percentage).toBe(50)
  })

  it("marks a complete profile as 100 percent", () => {
    const completion = getProfileCompletion({
      full_name: "Giorgi",
      city: "თბილისი",
      avatar_url: "https://example.com/avatar.jpg",
      store_phone: "+995555123456",
    })

    expect(completion.percentage).toBe(100)
    expect(completion.missing).toEqual([])
    expect(completion.canPublishListing).toBe(true)
  })
})
