import { describe, expect, it } from "vitest"
import {
  detectListingImageMimeType,
  validateListingInput,
} from "@/lib/listing-form"
import { validateImageFile } from "@/lib/listings"

const validInput = {
  title: "ტყავის ქურთუკი",
  description: "კარგ მდგომარეობაშია და დეფექტი არ აქვს.",
  price: "120.50",
  categoryId: 1,
  brandId: "",
  sizeId: "",
  condition: "good",
  saleType: "sell",
  gender: "unisex",
  color: "შავი",
  material: "ტყავი",
  city: "თბილისი",
  sellerPhone: "+995 555 12 34 56",
  publishNow: true,
}

describe("listing form validation", () => {
  it("normalizes a valid GEL price without floating-point conversion", () => {
    const result = validateListingInput({ ...validInput, price: "00120,5" })
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ price: "120.50" }),
    })
  })

  it("rejects whitespace-only and overlong public text", () => {
    const result = validateListingInput({
      ...validInput,
      title: "   ",
      description: "x".repeat(3_001),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors.title).toBeTruthy()
      expect(result.fieldErrors.description).toBeTruthy()
    }
  })

  it.each(["0", "-1", "1.999", "1e5", "100000000"])(
    "rejects malformed or unsupported price %s",
    (price) => {
      const result = validateListingInput({ ...validInput, price })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.fieldErrors.price).toBeTruthy()
    }
  )

  it("rejects invalid lookup IDs and enum injection", () => {
    const result = validateListingInput({
      ...validInput,
      categoryId: "../admin",
      brandId: "not-a-uuid",
      sizeId: "also-not-a-uuid",
      condition: "sold",
      saleType: "auction",
      gender: "private",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors.categoryId).toBeTruthy()
      expect(result.fieldErrors.brandId).toBeTruthy()
      expect(result.fieldErrors.sizeId).toBeTruthy()
      expect(result.fieldErrors.condition).toBeTruthy()
      expect(result.fieldErrors.saleType).toBeTruthy()
      expect(result.fieldErrors.gender).toBeTruthy()
    }
  })

  it.each(["", "123", "+995<script>", "+995 555 12 34 56 7890"])(
    "rejects an invalid public seller phone %s",
    (sellerPhone) => {
      const result = validateListingInput({ ...validInput, sellerPhone })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.fieldErrors.sellerPhone).toBeTruthy()
    },
  )

  it("uses an explicit MIME allowlist and a 7 MB size limit", () => {
    expect(validateImageFile(new File(["ok"], "item.jpg", { type: "image/jpeg" }))).toBeNull()
    expect(validateImageFile(new File(["bad"], "item.svg", { type: "image/svg+xml" }))).toMatch(/JPEG/)
    expect(
      validateImageFile(
        new File([new Uint8Array(7 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })
      )
    ).toMatch(/7MB/)
  })

  it("detects JPEG, PNG, and WEBP by file signature", () => {
    expect(detectListingImageMimeType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg")
    expect(
      detectListingImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe("image/png")
    expect(
      detectListingImageMimeType(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
      )
    ).toBe("image/webp")
    expect(detectListingImageMimeType(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull()
  })
})
