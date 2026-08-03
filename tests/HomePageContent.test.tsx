import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import HomePageContent from "@/components/home/HomePageContent"
import { ka } from "@/lib/i18n/ka"
import type { HomePageData } from "@/lib/home-page"
import { makeListing } from "@/tests/fixtures"

function makeHomeData(): HomePageData {
  const listing = makeListing()
  return {
    user: null,
    heroItems: [listing],
    bannerItems: [],
    latestItems: [listing],
    popularItems: [],
    affordableItems: [],
    vintageItems: [],
    popularBrands: [{ name: "SAMO", count: 1 }],
    favoriteIds: [],
    activeCount: 1,
  }
}

describe("HomePageContent", () => {
  it("renders the original hero, real product section, brands, and how-it-works content", () => {
    render(<HomePageContent data={makeHomeData()} />)

    expect(screen.getByRole("heading", { level: 1, name: ka.home.title })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: ka.home.startShopping })).toHaveAttribute("href", "/catalog")
    expect(screen.getByRole("link", { name: ka.home.startSelling })).toHaveAttribute(
      "href",
      "/dashboard/listings/new",
    )
    expect(screen.getByRole("heading", { name: ka.home.latest })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.brands })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.howItWorks })).toBeInTheDocument()
  })

  it("does not invent product sections when their data source is empty", () => {
    const data = makeHomeData()
    data.latestItems = []
    data.popularItems = []
    data.affordableItems = []
    data.vintageItems = []
    data.popularBrands = []

    render(<HomePageContent data={data} />)

    expect(screen.queryByRole("heading", { name: ka.home.latest })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: ka.home.popular })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.emptyTitle })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.howItWorks })).toBeInTheDocument()
  })
})
