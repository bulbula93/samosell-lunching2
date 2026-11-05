import { act, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import AdCarousel from "@/components/ads/AdCarousel"
import type { AdRecord } from "@/lib/ads"
vi.mock("@/components/ads/AdBanner", () => ({ default: ({ ad }: { ad: AdRecord }) => <span>{ad.title}</span> }))
vi.mock("@/components/ads/AdPlaceholder", () => ({ default: () => <span>placeholder</span> }))
afterEach(() => { vi.useRealTimers() })
describe("scheduled ad in cached home HTML", () => {
  it("does not SSR a future ad, then activates and expires it locally at its deadlines", async () => {
    vi.useFakeTimers()
    const start = Date.parse("2026-11-02T00:00:00Z")
    vi.setSystemTime(start)
    const ad: AdRecord = { id: "scheduled", placement_key: "home_hero_left", title: "scheduled placement", description: null, image_url: null, target_url: null, advertiser_name: null, created_at: new Date(start).toISOString(), is_active: true, priority: 1, starts_at: new Date(start + 1000).toISOString(), ends_at: new Date(start + 2000).toISOString() }
    const element = <AdCarousel ads={[ad]} renderedAt={start} pagePath="/" fallbackPlacement="home_hero_left" />
    expect(renderToStaticMarkup(element)).not.toContain("scheduled placement")
    render(element)
    expect(screen.queryByText("scheduled placement")).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByText("scheduled placement")).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1001) })
    expect(screen.queryByText("scheduled placement")).not.toBeInTheDocument()
  })
})
