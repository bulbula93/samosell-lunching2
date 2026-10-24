import { describe, expect, it } from "vitest"
import { buildListingShareCaption, buildListingSharePost } from "@/lib/share-post"

describe("listing share text", () => {
  it("builds a group-ready post with size, price, condition and city", () => {
    const caption = buildListingShareCaption({
      title: "ქალის ზამთრის პალტო",
      sizeLabel: "M",
      priceText: "45 ₾",
      conditionText: "ახალი",
      city: "თბილისი",
    })

    expect(caption).toBe("ქალის ზამთრის პალტო · M\n45 ₾\nახალი · თბილისი")
  })

  it("never leaves empty lines when optional fields are missing", () => {
    const caption = buildListingShareCaption({ title: "კაბა", priceText: "30 ₾" })

    expect(caption).toBe("კაბა\n30 ₾")
    expect(caption).not.toContain("\n\n")
  })

  it("ignores blank and whitespace-only values", () => {
    const caption = buildListingShareCaption({
      title: "  ჩექმა  ",
      sizeLabel: "   ",
      priceText: null,
      conditionText: " ",
      city: "ბათუმი",
    })

    expect(caption).toBe("ჩექმა\nბათუმი")
  })

  it("does not end sentences with an ellipsis", () => {
    const caption = buildListingShareCaption({ title: "ჯინსი", priceText: "25 ₾" })

    expect(caption).not.toMatch(/\.\.\.$/)
    expect(caption.trimEnd()).toBe(caption)
  })

  it("keeps the link on its own paragraph so messengers do not merge it", () => {
    const post = buildListingSharePost("კაბა\n30 ₾", "https://samosell.ge/listing/kaba-0c50ad25")

    expect(post).toBe("კაბა\n30 ₾\n\nhttps://samosell.ge/listing/kaba-0c50ad25")
  })

  it("falls back to the link alone when the caption is empty", () => {
    expect(buildListingSharePost("   ", "https://samosell.ge/listing/x")).toBe(
      "https://samosell.ge/listing/x",
    )
  })
})
