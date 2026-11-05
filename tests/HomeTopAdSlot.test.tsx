import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import HomePageContent from "@/components/home/HomePageContent"
import type { HomePageData } from "@/lib/home-page"
import { makeListing } from "@/tests/fixtures"

function homeData(): HomePageData {
  return {
    user: null,
    heroItems: [],
    vipItems: [],
    bannerItems: [],
    latestItems: [makeListing({ cover_image_url: "/listing.jpg" })],
    popularItems: [],
    affordableItems: [],
    vintageItems: [],
    popularBrands: [],
    favoriteIds: [],
    activeCount: 1,
  }
}

describe("home top ad slot", () => {
  it("replaces the empty stories slot with a single ad section right after the hero", () => {
    const { container } = render(<HomePageContent data={homeData()} />)

    const adSections = screen.getAllByRole("region", { name: "რეკლამა" })
    expect(adSections).toHaveLength(1)
    expect(adSections[0]).toHaveAttribute("data-home-top-ad")
    expect(container.querySelector("[data-home-stories-slot]")).toBeNull()

    // With no paid ads, the self-service "advertise with us" placeholder fills the slot.
    expect(screen.getAllByRole("link", { name: "რეკლამის შექმნა" })[0]).toHaveAttribute("href", "/advertise")

    // The ad sits above the first product section.
    const latestHeading = screen.getByRole("heading", { name: "ბოლოს დამატებული" })
    expect(adSections[0].compareDocumentPosition(latestHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
