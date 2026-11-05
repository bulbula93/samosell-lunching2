import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import SmartImage, { shouldCoverForAspect } from "@/components/shared/SmartImage"

const LOCAL_PREVIEW = "blob:https://samosell.ge/7b1f"

function loadWithSize(image: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(image, "naturalWidth", { configurable: true, value: width })
  Object.defineProperty(image, "naturalHeight", { configurable: true, value: height })
  fireEvent.load(image)
}

describe("shouldCoverForAspect", () => {
  const card = 4 / 5
  it.each([
    ["phone portrait 3:4", 3 / 4, true],
    ["exact 4:5", 4 / 5, true],
    ["tall 9:16", 9 / 16, false],
    ["square 1:1", 1, false],
    ["landscape 4:3", 4 / 3, false],
    ["landscape 16:9", 16 / 9, false],
  ])("%s -> cover=%s", (_label, aspect, expected) => {
    expect(shouldCoverForAspect(aspect, card)).toBe(expected)
  })

  it("falls back to cover when dimensions are unknown", () => {
    expect(shouldCoverForAspect(0, card)).toBe(true)
    expect(shouldCoverForAspect(1, 0)).toBe(true)
  })
})

describe("SmartImage fit", () => {
  it("keeps cover cropping by default and renders a single image", () => {
    const { container } = render(<SmartImage src={LOCAL_PREVIEW} alt="ქურთუკი" />)
    const images = container.querySelectorAll("img")

    expect(images).toHaveLength(1)
    expect(images[0].className).toContain("object-cover")
  })

  it("auto: a phone portrait photo fills the card with no bands and no backdrop", () => {
    const { container, getByAltText } = render(
      <SmartImage src={LOCAL_PREVIEW} alt="ქურთუკი" fit="auto" frameAspect={4 / 5} backdrop />,
    )
    const main = getByAltText("ქურთუკი") as HTMLImageElement
    loadWithSize(main, 3024, 4032)

    expect(main.dataset.fit).toBe("cover")
    expect(main.className).toContain("object-cover")
    expect(container.querySelectorAll("img")).toHaveLength(1)
  })

  it("auto: a landscape banner is shown whole on an opaque blurred backdrop", () => {
    const { container, getByAltText } = render(
      <SmartImage src={LOCAL_PREVIEW} alt="ბანერი" fit="auto" frameAspect={4 / 5} backdrop />,
    )
    const main = getByAltText("ბანერი") as HTMLImageElement
    loadWithSize(main, 1600, 1000)

    const images = Array.from(container.querySelectorAll("img"))
    const backdrop = images.find((image) => image !== getByAltText("ბანერი"))
    expect(getByAltText("ბანერი").className).toContain("object-contain")
    expect(images).toHaveLength(2)
    expect(backdrop?.getAttribute("aria-hidden")).toBe("true")
    expect(backdrop?.getAttribute("alt")).toBe("")
    expect(backdrop?.className).toContain("blur-xl")
    // Opaque: no translucent layer that lets the grey placeholder show through.
    expect(backdrop?.className).not.toMatch(/opacity-\d/)
  })

  it("contain always shows the whole photo", () => {
    const { getByAltText } = render(<SmartImage src={LOCAL_PREVIEW} alt="ქურთუკი" fit="contain" />)
    expect(getByAltText("ქურთუკი").className).toContain("object-contain")
  })
})

describe("listing surfaces use the shape-aware fit", () => {
  it.each([
    ["components/listings/MarketplaceProductCard.tsx", /fit="auto"\s+frameAspect=\{4 \/ 5\}\s+backdrop/],
    ["components/listings/CatalogLandingCard.tsx", /fit="auto"\s+frameAspect=\{0\.95\}\s+backdrop/],
    ["components/listings/ListingGallery.tsx", /fit="contain"\s+backdrop/],
    ["components/dashboard/CreateListingWizard.tsx", /fit="auto"\s+frameAspect=\{4 \/ 5\}\s+backdrop/],
  ])("%s", (path, pattern) => {
    const source = readFileSync(join(process.cwd(), path), "utf8")
    expect(source).toMatch(pattern)
  })
})
