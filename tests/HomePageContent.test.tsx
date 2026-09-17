import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import HomePageContent from "@/components/home/HomePageContent"
import SiteFooter from "@/components/layout/SiteFooter"
import { ka } from "@/lib/i18n/ka"
import type { HomePageData } from "@/lib/home-page"
import { makeListing } from "@/tests/fixtures"

function makeHomeData(): HomePageData {
  const listing = makeListing({ cover_image_url: "/listing.jpg" })
  const vipListing = makeListing({ id: "vip-rail-1", title: "VIP ნივთი", cover_image_url: "/vip.jpg", is_vip: true })
  const vipMaxListing = makeListing({
    id: "vip-max-1",
    title: "VIP MAX ნივთი",
    cover_image_url: "/vip-max.jpg",
    is_vip: true,
    is_promoted: true,
    is_featured: true,
  })

  return {
    user: null,
    heroItems: [vipMaxListing],
    vipItems: [vipListing, vipMaxListing],
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

  it("renders the hero, dedicated VIP rail, real product section, brands, and how-it-works content", () => {
    render(<HomePageContent data={makeHomeData()} />)

    expect(screen.getByRole("heading", { level: 1, name: ka.home.title })).toBeInTheDocument()
    expect(screen.getByText(ka.home.description)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "VIP განცხადებები" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.latest })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.brands })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.howItWorks })).toBeInTheDocument()
    expect(screen.getByText("ქართული მეორადი ტანსაცმლის ონლაინ პლატფორმა")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "გამოაჩინე განცხადება დიდ სარეკლამო სივრცეში" })).toBeInTheDocument()
    expect(screen.getByText(/ბანერის პაკეტი განცხადებას 7 დღით ათავსებს მთავარ გვერდზე დიდ ვიზუალურ ბლოკში/)).toBeInTheDocument()
  })

  it("renders only VIP MAX listings in the hero carousel and keeps neighboring VIP MAX cards visible", () => {
    const data = makeHomeData()
    data.heroItems = [
      makeListing({ id: "max-1", title: "VIP MAX კაბა", cover_image_url: "/max-1.jpg", is_vip: true, is_promoted: true, is_featured: true }),
      makeListing({ id: "max-2", title: "VIP MAX პალტო", cover_image_url: "/max-2.jpg", is_vip: true, is_promoted: true, is_featured: true }),
      makeListing({ id: "vip-only", title: "ჩვეულებრივი VIP", cover_image_url: "/vip-only.jpg", is_vip: true, is_promoted: false, is_featured: false }),
    ]

    render(<HomePageContent data={data} />)

    expect(screen.getAllByAltText("VIP MAX კაბა").length).toBeGreaterThan(0)
    expect(screen.getAllByAltText("VIP MAX პალტო").length).toBeGreaterThan(0)
    expect(screen.queryByAltText("ჩვეულებრივი VIP")).not.toBeInTheDocument()
    expect(screen.getByText("აქტიური VIP MAX განცხადება: VIP MAX კაბა")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "VIP MAX განცხადება: VIP MAX კაბა" })[0]).toHaveAttribute("href", "/listing/linen-jacket")

    fireEvent.click(screen.getByRole("button", { name: "შემდეგი განცხადება" }))
    expect(screen.getByText("აქტიური VIP MAX განცხადება: VIP MAX პალტო")).toBeInTheDocument()
    expect(screen.queryByAltText("ჩვეულებრივი VIP")).not.toBeInTheDocument()
  })

  it("does not fall back to popular listings when there is no VIP MAX listing", () => {
    const data = makeHomeData()
    data.heroItems = []
    data.popularItems = [
      makeListing({ id: "popular-1", title: "პოპულარული კაბა", cover_image_url: "/popular.jpg" }),
    ]

    render(<HomePageContent data={data} />)

    expect(screen.getByText("VIP MAX სივრცე")).toBeInTheDocument()
    expect(screen.getByText("აქ გამოჩნდება მხოლოდ აქტიური VIP MAX განცხადებები")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "პოპულარული ნივთები" })).not.toBeInTheDocument()
  })

  it("rotates VIP MAX hero listings every five seconds and supports pausing", () => {
    vi.useFakeTimers()
    const data = makeHomeData()
    data.heroItems = [
      makeListing({ id: "max-1", title: "პირველი VIP MAX", cover_image_url: "/max-1.jpg", is_vip: true, is_promoted: true, is_featured: true }),
      makeListing({ id: "max-2", title: "მეორე VIP MAX", cover_image_url: "/max-2.jpg", is_vip: true, is_promoted: true, is_featured: true }),
    ]

    render(<HomePageContent data={data} />)

    expect(screen.getByText("აქტიური VIP MAX განცხადება: პირველი VIP MAX")).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.getByText("აქტიური VIP MAX განცხადება: მეორე VIP MAX")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "ავტომატური მონაცვლეობის შეჩერება" }))
    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.getByText("აქტიური VIP MAX განცხადება: მეორე VIP MAX")).toBeInTheDocument()
  })

  it("shows the VIP MAX promotion when no VIP MAX listing exists", () => {
    const data = makeHomeData()
    data.heroItems = []

    render(<HomePageContent data={data} />)

    expect(screen.getByText("VIP MAX სივრცე")).toBeInTheDocument()
    expect(screen.getByText("აქ გამოჩნდება მხოლოდ აქტიური VIP MAX განცხადებები")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "გააქტიურე VIP MAX" })).toHaveAttribute("href", "/dashboard/listings")
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
    data.vipItems = []
    data.latestItems = []
    data.popularItems = []
    data.affordableItems = []
    data.vintageItems = []
    data.popularBrands = []

    render(<HomePageContent data={data} />)

    expect(screen.queryByRole("heading", { name: "VIP განცხადებები" })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: ka.home.latest })).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: ka.home.popular })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.emptyTitle })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: ka.home.howItWorks })).toBeInTheDocument()
  })
})
