import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import HomePageContent from "@/components/home/HomePageContent"
import SiteFooter from "@/components/layout/SiteFooter"
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
  afterEach(() => {
    vi.useRealTimers()
  })

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
    expect(screen.getByText("ქართული მეორადი ტანსაცმლის ონლაინ პლატფორმა")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "შექმენი VIP განცხადება" })).toBeInTheDocument()
    expect(screen.getByText("გახადე შენი განცხადება უფრო პოპულარული")).toBeInTheDocument()
  })

  it("renders only real VIP listings in the hero carousel", () => {
    const data = makeHomeData()
    data.heroItems = [
      makeListing({ id: "vip-1", title: "VIP კაბა", cover_image_url: "/vip-1.jpg", is_vip: true }),
      makeListing({ id: "vip-2", title: "VIP პალტო", cover_image_url: "/vip-2.jpg", is_vip: true }),
      makeListing({ id: "regular-1", title: "ჩვეულებრივი ჩანთა", cover_image_url: "/regular-1.jpg", is_vip: false }),
    ]

    render(<HomePageContent data={data} />)

    expect(screen.getByAltText("VIP კაბა")).toBeInTheDocument()
    expect(screen.queryByAltText("ჩვეულებრივი ჩანთა")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "VIP განცხადება: VIP კაბა" })).toHaveAttribute("href", "/listing/linen-jacket")

    fireEvent.click(screen.getByRole("button", { name: "შემდეგი განცხადება" }))
    expect(screen.getByAltText("VIP პალტო")).toBeInTheDocument()
    expect(screen.queryByAltText("ჩვეულებრივი ჩანთა")).not.toBeInTheDocument()
  })

  it("falls back to popular listings when no active VIP listing exists", () => {
    const data = makeHomeData()
    data.heroItems = []
    data.popularItems = [
      makeListing({ id: "popular-1", title: "პოპულარული კაბა", cover_image_url: "/popular.jpg" }),
    ]

    render(<HomePageContent data={data} />)

    const popularCarousel = screen.getByRole("region", { name: "პოპულარული ნივთები" })
    expect(popularCarousel).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "პოპულარული განცხადება: პოპულარული კაბა" })).toHaveAttribute(
      "href",
      "/listing/linen-jacket",
    )
    expect(within(popularCarousel).getByAltText("პოპულარული კაბა")).toBeInTheDocument()
    expect(screen.queryByText("VIP სივრცე")).not.toBeInTheDocument()
  })

  it("rotates hero listings every five seconds and supports pausing", () => {
    vi.useFakeTimers()
    const data = makeHomeData()
    data.heroItems = [
      makeListing({ id: "vip-1", title: "პირველი VIP", cover_image_url: "/vip-1.jpg", is_vip: true }),
      makeListing({ id: "vip-2", title: "მეორე VIP", cover_image_url: "/vip-2.jpg", is_vip: true }),
    ]

    render(<HomePageContent data={data} />)

    expect(screen.getByAltText("პირველი VIP")).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.getByAltText("მეორე VIP")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "ავტომატური მონაცვლეობის შეჩერება" }))
    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.getByAltText("მეორე VIP")).toBeInTheDocument()
  })

  it("shows the VIP promotion only when neither VIP nor popular listings exist", () => {
    const data = makeHomeData()
    data.heroItems = []
    data.popularItems = []

    render(<HomePageContent data={data} />)

    expect(screen.getByText("VIP სივრცე")).toBeInTheDocument()
    expect(screen.getByText("აქ გამოჩნდება მხოლოდ აქტიური VIP განცხადებები")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "შექმენი VIP განცხადება" })[0]).toHaveAttribute("href", "/dashboard/listings")
  })

  it("renders the requested footer description without a sentence-ending period", () => {
    render(<SiteFooter />)

    const description = screen.getByText(
      "ქართული მეორადი ტანსაცმლის ონლაინ პლატფორმა, სადაც მყიდველი და გამყიდველი ერთმანეთს პირადად ეკონტაქტებიან და ათანხმებენ შეძენის პირობებს ყოველგვარი საკომისიოს გარეშე",
    )
    expect(description.textContent?.endsWith(".")).toBe(false)
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
