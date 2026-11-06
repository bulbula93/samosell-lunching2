import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import HomeProductsSection from "@/components/home/HomeProductsSection"
import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import SiteFooter from "@/components/layout/SiteFooter"
import { makeListing } from "@/tests/fixtures"

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8")
const items = Array.from({ length: 10 }, (_, index) => makeListing({ id: `l-${index}`, slug: `l-${index}`, title: `ნივთი ${index}` }))

describe("mobile layout polish", () => {
  it("hero headline is phone-sized and CTAs sit in a 2-column row on phones", () => {
    const hero = read("components", "home", "HomeSearchHeroSection.tsx")
    expect(hero).toContain("max-w-none text-balance text-[1.8rem]")
    expect(hero).toContain("sm:text-[clamp(2.45rem,5vw,4.65rem)]")
    expect(hero).toContain("mt-5 grid grid-cols-2 gap-3")
    expect(hero).not.toContain("min-h-[380px] items-center gap-6 px-6 py-9")
  })

  it("rail layout swipes on phones and becomes a grid from sm up", () => {
    const { container } = render(<HomeProductsSection title="პოპულარული" href="/catalog" items={items} favoriteIds={[]} layout="rail" />)
    const rail = container.querySelector("[data-home-rail]")!
    expect(rail.className).toContain("overflow-x-auto")
    expect(rail.className).toContain("sm:grid")
    expect(rail.children).toHaveLength(10)
  })

  it("latest grid shows six cards on phones and the rest from sm up", () => {
    const { container } = render(<HomeProductsSection title="ბოლოს" href="/catalog" items={items} favoriteIds={[]} mobileLimit={6} />)
    expect(container.querySelectorAll("article")).toHaveLength(10)
    expect(container.querySelectorAll(".hidden.sm\\:block article")).toHaveLength(4)
  })

  it("secondary home sections use the rail and latest is capped on phones", () => {
    const home = read("components", "home", "HomePageContent.tsx")
    expect(home).toContain("items={data.latestItems} favoriteIds={[]} mobileLimit={6}")
    expect(home).toContain("items={data.popularItems} favoriteIds={[]} layout=\"rail\"")
    expect(home).toContain("items={data.affordableItems} favoriteIds={[]} layout=\"rail\"")
    expect(home).toContain("items={data.vintageItems} favoriteIds={[]} layout=\"rail\"")
  })

  it("card condition and city wrap instead of being truncated", () => {
    render(<MarketplaceProductCard item={makeListing({ condition: "like_new", city: "რუსთავი" })} />)
    const meta = document.querySelector("[data-card-meta]")!
    expect(meta.className).toContain("flex-wrap")
    expect(meta.innerHTML).not.toContain("truncate")
    expect(within(meta as HTMLElement).getByText("რუსთავი")).toBeInTheDocument()
  })

  it("card has no text below 10px", () => {
    const card = read("components", "listings", "MarketplaceProductCard.tsx")
    expect(card).not.toMatch(/text-\[(8|9)px\]/)
  })

  it("footer groups are 44px accordions on phones", () => {
    const { container } = render(<SiteFooter />)
    const accordions = container.querySelectorAll("details[data-footer-accordion]")
    expect(accordions).toHaveLength(3)
    for (const details of accordions) {
      expect(details.className).toContain("sm:hidden")
      expect(details.querySelector("summary")!.className).toContain("min-h-12")
      for (const link of details.querySelectorAll("a")) expect(link.className).toContain("min-h-11")
    }
    expect(screen.getAllByRole("link", { name: "კონტაქტი" }).length).toBeGreaterThan(0)
  })

  it("catalog header drops the repeated tagline on phones", () => {
    const header = read("components", "listings", "CatalogPageHeader.tsx")
    expect(header).toContain('className="hidden text-xs font-black uppercase tracking-[0.2em] text-brand sm:block"')
  })
})
