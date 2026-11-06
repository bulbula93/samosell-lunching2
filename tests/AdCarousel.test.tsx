import { readFileSync } from "node:fs"
import { join } from "node:path"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import AdCarousel from "@/components/ads/AdCarousel"
import type { AdRecord } from "@/lib/ads"

vi.mock("@/components/ads/AdImpressionTracker", () => ({ default: () => null }))

function ad(id: string, title: string): AdRecord {
  return {
    id,
    placement_key: "home_hero_left",
    title,
    description: "აღწერა",
    image_url: null,
    target_url: "https://example.com",
    is_active: true,
    starts_at: null,
    ends_at: null,
    priority: 0,
    advertiser_name: title,
    created_at: "2026-11-01T00:00:00Z",
  }
}

const ADS = [ad("a1", "პირველი"), ad("b2", "მეორე"), ad("c3", "მესამე")]

describe("AdCarousel home slot policy", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("renders nothing when there is no live paid ad", () => {
    const { container } = render(<AdCarousel ads={[]} pagePath="/" />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole("region", { name: "რეკლამა" })).not.toBeInTheDocument()
  })

  it("shows exactly one ad at a time, full width", () => {
    render(<AdCarousel ads={ADS} pagePath="/" />)
    expect(screen.getAllByRole("article")).toHaveLength(1)
    expect(screen.getAllByRole("button", { name: /^რეკლამა \d \/ 3$/ })).toHaveLength(3)
  })

  it("starts on a random ad so first impressions are shared fairly", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7) // floor(0.7 * 3) = 2
    render(<AdCarousel ads={ADS} pagePath="/" />)
    // Server markup and the first client render agree on ad 1; the random pick happens right after hydration.
    expect(await screen.findByRole("heading", { name: "მესამე" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "რეკლამა 3 / 3" })).toHaveAttribute("aria-current", "true")
  })

  it("rotates every 6 seconds and pauses while hovered", () => {
    vi.useFakeTimers()
    vi.spyOn(Math, "random").mockReturnValue(0)
    render(<AdCarousel ads={ADS} pagePath="/" />)
    expect(screen.getByRole("heading", { name: "პირველი" })).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(6000) })
    expect(screen.getByRole("heading", { name: "მეორე" })).toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByRole("article").parentElement!.parentElement!)
    act(() => { vi.advanceTimersByTime(12000) })
    expect(screen.getByRole("heading", { name: "მეორე" })).toBeInTheDocument()
  })

  it("lets the viewer pick an ad from the dots", () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    render(<AdCarousel ads={ADS} pagePath="/" />)
    fireEvent.click(screen.getByRole("button", { name: "რეკლამა 2 / 3" }))
    expect(screen.getByRole("heading", { name: "მეორე" })).toBeInTheDocument()
  })

  it("counts impressions only after the ad is visible", () => {
    const source = readFileSync(join(process.cwd(), "components", "ads", "AdImpressionTracker.tsx"), "utf8")
    expect(source).toContain("IntersectionObserver")
    expect(source).toContain("intersectionRatio >= 0.5")
  })

  it("caps the paid rotation at three concurrent campaigns", () => {
    const source = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20261106080000_limit_home_ad_rotation_to_three.sql"),
      "utf8",
    )
    expect(source).toContain("status in ('active','scheduled')")
    expect(source).toContain(") < 3")
    expect(source).toContain("'active_limit',3")
    expect(source).toContain("order by candidate")
  })

  it("tells advertisers the slot policy before they pay", () => {
    const page = readFileSync(join(process.cwd(), "app", "advertise", "page.tsx"), "utf8")
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20261106080000_limit_home_ad_rotation_to_three.sql"),
      "utf8",
    )
    expect(page).toContain("data-ad-slot-policy")
    expect(page).toContain("3 რეკლამა")
    expect(migration).toContain("მაქსიმუმ 3 რეკლამა მონაცვლეობს")
    expect(migration).not.toContain("ერთ-ერთ ორ")
  })
})
