import { describe, expect, it } from "vitest"
import {
  buildListingCardDescription,
  buildListingShareCaption,
  buildListingSharePost,
} from "@/lib/share-post"

describe("listing share caption", () => {
  it("keeps the item, size and price on the first line a buyer scans", () => {
    const caption = buildListingShareCaption({
      title: "ქალის ზამთრის პალტო",
      sizeLabel: "M",
      priceText: "45 ₾",
      conditionText: "ახალი",
      city: "თბილისი",
    })

    expect(caption).toBe("ქალის ზამთრის პალტო · M · 45 ₾\nახალი · თბილისი")
  })

  it("never leaves empty lines when optional fields are missing", () => {
    const caption = buildListingShareCaption({ title: "კაბა", priceText: "30 ₾" })

    expect(caption).toBe("კაბა · 30 ₾")
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
    const post = buildListingSharePost("კაბა · 30 ₾", "https://samosell.ge/listing/kaba-0c50ad25")

    expect(post).toBe("კაბა · 30 ₾\n\nhttps://samosell.ge/listing/kaba-0c50ad25")
  })

  it("falls back to the link alone when the caption is empty", () => {
    expect(buildListingSharePost("   ", "https://samosell.ge/listing/x")).toBe(
      "https://samosell.ge/listing/x",
    )
  })
})

describe("listing link-preview description", () => {
  it("leads with structured facts instead of generic filler", () => {
    const description = buildListingCardDescription(
      { sizeLabel: "3XL", conditionText: "ახალი", city: "თბილისი", brandName: "LOVE&SPORTS" },
      "ახალი ჩაუცმელი.",
    )

    expect(description).toBe("3XL · ახალი · თბილისი · LOVE&SPORTS — ახალი ჩაუცმელი.")
  })

  it("returns only the facts when the seller wrote no description", () => {
    expect(buildListingCardDescription({ sizeLabel: "M", city: "ბათუმი" }, "")).toBe(
      "M · ბათუმი",
    )
  })

  it("falls back to the seller text when no facts are known", () => {
    expect(buildListingCardDescription({}, "ვინტაჟური ქურთუკი")).toBe("ვინტაჟური ქურთუკი")
  })

  it("truncates the seller text so the card stays readable", () => {
    const long = "ს".repeat(400)
    const description = buildListingCardDescription({ sizeLabel: "M" }, long, 120)

    expect(description.length).toBeLessThanOrEqual(120)
    expect(description.startsWith("M — ")).toBe(true)
    expect(description.endsWith("…")).toBe(true)
  })

  it("collapses newlines from multi-line seller text", () => {
    expect(buildListingCardDescription({ city: "თბილისი" }, "ხაზი ერთი\n\nხაზი ორი")).toBe(
      "თბილისი — ხაზი ერთი ხაზი ორი",
    )
  })
})
