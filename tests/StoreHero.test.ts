import { describe, expect, it } from "vitest"
import { normalizeStoreHero, STORE_HERO_LIMITS } from "@/lib/store-hero"

describe("Owner-controlled store Hero", () => {
  it("uses empty content instead of invented marketing copy for existing profiles", () => {
    expect(normalizeStoreHero(null)).toEqual({
      eyebrow: "", headline: "", description: "", coverTitle: "", coverSubtitle: "",
    })
    expect(normalizeStoreHero([]).headline).toBe("")
  })

  it("normalizes owner-authored text and drops unexpected fields", () => {
    expect(normalizeStoreHero({
      eyebrow: "  ქართული მაღაზია  ",
      headline: " ახალი კოლექცია ",
      description: " შერჩეული ნივთები ",
      coverTitle: " შენი სტილი ",
      coverSubtitle: " თბილისი ",
      admin: "unauthorized",
    })).toEqual({
      eyebrow: "ქართული მაღაზია",
      headline: "ახალი კოლექცია",
      description: "შერჩეული ნივთები",
      coverTitle: "შენი სტილი",
      coverSubtitle: "თბილისი",
    })
  })

  it("enforces visible text limits for every field", () => {
    const longText = "ა".repeat(500)
    const content = normalizeStoreHero({
      eyebrow: longText,
      headline: longText,
      description: longText,
      coverTitle: longText,
      coverSubtitle: longText,
    })
    for (const field of Object.keys(STORE_HERO_LIMITS) as Array<keyof typeof STORE_HERO_LIMITS>) {
      expect(content[field].length).toBe(STORE_HERO_LIMITS[field])
    }
  })

  it("ignores non-string fields safely", () => {
    expect(normalizeStoreHero({headline: {value:"unexpected"}, description: 5}).headline).toBe("")
    expect(normalizeStoreHero({headline: {value:"unexpected"}, description: 5}).description).toBe("")
  })
})
