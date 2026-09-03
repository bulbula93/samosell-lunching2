import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/ads/AdImpressionTracker", () => ({ default: () => null }))
vi.mock("@/lib/ad-data", () => ({ getActiveAdsForPlacements: vi.fn(async () => ({})) }))

import AdBanner from "@/components/ads/AdBanner"
import AdPlacement from "@/components/ads/AdPlacement"
import AdSlotRow from "@/components/ads/AdSlotRow"
import {
  ADVERTISE_WITH_US_HREF,
  selectActiveAds,
  type AdRecord,
} from "@/lib/ads"

const now = new Date("2026-09-02T12:00:00.000Z")

function makeAd(overrides: Partial<AdRecord> = {}): AdRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    placement_key: "home_hero_left",
    title: "შემოდგომის კოლექცია",
    description: "SamoSell-ის პარტნიორის სპეციალური შეთავაზება",
    image_url: null,
    target_url: "https://advertiser.example/offers",
    is_active: true,
    starts_at: null,
    ends_at: null,
    priority: 10,
    advertiser_name: "Example Brand",
    created_at: "2026-09-02T10:00:00.000Z",
    ...overrides,
  }
}

describe("global ad system", () => {
  it("selects the highest-priority active ad for the requested placement", () => {
    const selected = selectActiveAds(
      [makeAd({ priority: 1 }), makeAd({ id: "22222222-2222-4222-8222-222222222222", priority: 20 })],
      ["home_hero_left"],
      now,
    )

    expect(selected.home_hero_left?.priority).toBe(20)
  })

  it("ignores inactive, expired and future ads", () => {
    const selected = selectActiveAds(
      [
        makeAd({ is_active: false }),
        makeAd({ id: "22222222-2222-4222-8222-222222222222", ends_at: "2026-09-01T00:00:00.000Z" }),
        makeAd({ id: "33333333-3333-4333-8333-333333333333", starts_at: "2026-09-03T00:00:00.000Z" }),
      ],
      ["home_hero_left"],
      now,
    )

    expect(selected.home_hero_left).toBeUndefined()
  })

  it("renders the intentional fallback CTA when no active ad exists", () => {
    render(<AdPlacement placementKey="home_hero_left" pagePath="/" />)

    expect(screen.getByText("განათავსე რეკლამა ჩვენს გვერდზე")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "დაგვიკავშირდი" })).toHaveAttribute("href", ADVERTISE_WITH_US_HREF)
  })

  it("renders active advertiser content with sponsored link semantics", () => {
    render(<AdBanner ad={makeAd()} pagePath="/" />)

    expect(screen.getByText("შემოდგომის კოლექცია")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "შეთავაზების ნახვა" })
    expect(link).toHaveAttribute("rel", "sponsored noopener noreferrer")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link.getAttribute("href")).toContain("/api/ads/click?")
  })

  it("uses a one-column mobile layout and two columns from tablet width", async () => {
    const ui = await AdSlotRow({
      placementKeys: ["catalog_top_left", "catalog_top_right"],
      pagePath: "/catalog",
      contained: false,
    })
    const { container } = render(ui)

    expect(container.querySelector(".grid-cols-1")).toHaveClass("md:grid-cols-2")
    expect(screen.getAllByText("განათავსე რეკლამა ჩვენს გვერდზე")).toHaveLength(2)
  })

  it("queries only the placement keys supplied by the row", () => {
    const source = readFileSync(join(process.cwd(), "lib", "ad-data.ts"), "utf8")
    expect(source).toContain('.in("placement_key", [...placementKeys])')
    expect(source).toContain('.eq("is_active", true)')
    expect(source).toContain("unstable_rethrow(error)")
  })
})
