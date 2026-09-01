import { describe, expect, it } from "vitest"
import { generateUniqueListingSlug, slugify } from "@/lib/listings"

function slugClient(existing: string[] = []) {
  return {
    from: () => ({
      select: () => ({
        eq: (_column: string, candidate: string) => ({
          limit: async () => ({
            data: existing.includes(candidate) ? [{ id: "existing" }] : [],
            error: null,
          }),
        }),
      }),
    }),
  }
}

describe("listing SEO slugs", () => {
  it("transliterates Georgian titles", () => {
    expect(slugify("ზარას ტყავის ქურთუკი")).toBe("zaras-tqavis-kurtuki")
  })

  it("builds a deterministic collision-resistant slug from the stable listing id", async () => {
    const id = "a83f2c00-0000-4000-8000-000000000000"
    const client = slugClient()

    await expect(
      generateUniqueListingSlug(client as never, "ASOS Dress", id),
    ).resolves.toBe("asos-dress-a83f2c00")
  })

  it("extends the stable suffix when the short candidate already exists", async () => {
    const id = "a83f2c00-1234-4000-8000-000000000000"
    const client = slugClient(["asos-dress-a83f2c00"])

    await expect(
      generateUniqueListingSlug(client as never, "ASOS Dress", id),
    ).resolves.toBe("asos-dress-a83f2c001234")
  })
})
