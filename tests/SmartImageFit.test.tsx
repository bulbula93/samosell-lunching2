import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import SmartImage from "@/components/shared/SmartImage"

const LOCAL_PREVIEW = "blob:https://samosell.ge/7b1f"

describe("SmartImage fit", () => {
  it("keeps cover cropping by default and renders a single image", () => {
    const { container } = render(<SmartImage src={LOCAL_PREVIEW} alt="ქურთუკი" />)
    const images = container.querySelectorAll("img")

    expect(images).toHaveLength(1)
    expect(images[0].className).toContain("object-cover")
    expect(images[0].className).not.toContain("object-contain")
  })

  it("shows the whole photo with a blurred, hidden backdrop when contain + backdrop", () => {
    const { container, getByAltText } = render(
      <SmartImage src={LOCAL_PREVIEW} alt="ქურთუკი" fit="contain" backdrop />,
    )
    const images = Array.from(container.querySelectorAll("img"))
    const main = getByAltText("ქურთუკი") as HTMLImageElement
    const backdrop = images.find((image) => image !== main)

    expect(images).toHaveLength(2)
    expect(main.className).toContain("object-contain")
    expect(main.className).not.toContain("object-cover")
    expect(backdrop?.getAttribute("aria-hidden")).toBe("true")
    expect(backdrop?.getAttribute("alt")).toBe("")
    expect(backdrop?.className).toContain("blur-2xl")
    // Backdrop is painted first so the sharp photo sits on top of it.
    expect(images.indexOf(backdrop!)).toBeLessThan(images.indexOf(main))
  })

  it("does not add a backdrop for contain without backdrop", () => {
    const { container } = render(<SmartImage src={LOCAL_PREVIEW} alt="ქურთუკი" fit="contain" />)
    expect(container.querySelectorAll("img")).toHaveLength(1)
  })
})

describe("listing surfaces show the full photo", () => {
  it.each([
    ["components/listings/MarketplaceProductCard.tsx"],
    ["components/listings/CatalogLandingCard.tsx"],
    ["components/listings/ListingGallery.tsx"],
  ])("%s uses contain with backdrop", (path) => {
    const source = readFileSync(join(process.cwd(), path), "utf8")
    expect(source).toMatch(/fit="contain"\s+backdrop/)
  })

  it("wizard preview shows the full cover photo", () => {
    const source = readFileSync(join(process.cwd(), "components/dashboard/CreateListingWizard.tsx"), "utf8")
    expect(source).toContain('alt="მთავარი ფოტო" className="relative h-full w-full object-contain"')
  })
})
