import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import HomePageContent from "@/components/home/HomePageContent"
import SiteFooter from "@/components/layout/SiteFooter"
import type { HomePageData } from "@/lib/home-page"
import type { AdRecord } from "@/lib/ads"
import { makeListing } from "@/tests/fixtures"

vi.mock("@/components/ads/AdImpressionTracker", () => ({ default: () => null }))

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

const liveAd: AdRecord = {
  id: "ad-1",
  placement_key: "home_hero_left",
  title: "ბრენდის შეთავაზება",
  description: "აღწერა",
  image_url: null,
  target_url: "https://example.com",
  is_active: true,
  starts_at: null,
  ends_at: null,
  priority: 0,
  advertiser_name: "ბრენდი",
  created_at: "2026-11-01T00:00:00Z",
}

describe("home top ad slot", () => {
  it("collapses completely when there is no paid ad (no filler, no empty band)", () => {
    const { container } = render(<HomePageContent data={homeData()} heroAds={[]} />)

    expect(screen.queryByRole("region", { name: "რეკლამა" })).not.toBeInTheDocument()
    expect(container.querySelector("[data-home-top-ad]")).toBeNull()
    expect(container.querySelector("[data-home-stories-slot]")).toBeNull()
    expect(screen.queryByRole("link", { name: "რეკლამის შექმნა" })).not.toBeInTheDocument()
  })

  it("shows one paid ad right after the hero, above the first product section", () => {
    render(<HomePageContent data={homeData()} heroAds={[liveAd]} />)

    const adSections = screen.getAllByRole("region", { name: "რეკლამა" })
    expect(adSections).toHaveLength(1)
    expect(within(adSections[0]).getAllByRole("article")).toHaveLength(1)
    const latestHeading = screen.getByRole("heading", { name: "ბოლოს დამატებული" })
    expect(adSections[0].compareDocumentPosition(latestHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("keeps advertising discoverable from the footer", () => {
    render(<SiteFooter />)
    // Rendered twice: mobile accordion + desktop column (CSS shows one).
    const links = screen.getAllByRole("link", { name: "რეკლამა SamoSell-ზე" })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute("href", "/advertise")
  })
})
