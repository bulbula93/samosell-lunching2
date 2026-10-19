import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import PromotionExpiry from "@/components/shared/PromotionExpiry"
import { HomePersonalizationProvider, useHomePersonalization } from "@/components/home/HomePersonalizationProvider"
import { refreshPromotion } from "@/lib/promotion-expiry"
import { makeListing } from "@/tests/fixtures"

const auth = vi.hoisted(() => ({ changed: null as null | ((event: string) => void), unsubscribe: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  onAuthStateChange: (callback: (event: string) => void) => {
    auth.changed = callback
    return { data: { subscription: { unsubscribe: auth.unsubscribe } } }
  },
} }) }))
function State() {
  const value = useHomePersonalization()
  return <output data-testid="state">{JSON.stringify(value)}</output>
}
const payload = (id: string) => ({ userState: { userId: id, signedIn: true, profileLabel: id }, favoriteIds: [id], storyRail: null })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("public HTML and private personalization", () => {
  it("discards an old user's response after sign-out and account switching, even when the transport ignores abort", async () => {
    vi.useFakeTimers()
    let finishA!: (response: Response) => void
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finishA = resolve }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload("user-B"))))
    vi.stubGlobal("fetch", fetcher)
    render(<HomePersonalizationProvider><State /></HomePersonalizationProvider>)
    expect(screen.getByTestId("state")).not.toHaveTextContent("user-A")
    act(() => { auth.changed!("SIGNED_OUT"); auth.changed!("SIGNED_IN") })
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByTestId("state")).toHaveTextContent("user-B")
    await act(async () => { finishA(new Response(JSON.stringify(payload("user-A")))); await Promise.resolve() })
    expect(screen.getByTestId("state")).toHaveTextContent("user-B")
    expect(screen.getByTestId("state")).not.toHaveTextContent("user-A")
    expect(fetcher.mock.calls.every(([, options]) => options.cache === "no-store" && options.credentials === "same-origin")).toBe(true)
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it("removes a paid placement at its deadline in an already open cached page", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"))
    render(<PromotionExpiry until="2026-10-19T00:00:01Z" fallback={<span>standard placement</span>}><span>paid placement</span></PromotionExpiry>)
    expect(screen.getByText("paid placement")).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.queryByText("paid placement")).not.toBeInTheDocument()
    expect(screen.getByText("standard placement")).toBeInTheDocument()
  })

  it("preserves the live VIP badge on legacy catalog/search rows without deadline columns", () => {
    render(<MarketplaceProductCard item={makeListing({ is_vip: true, vip_until: undefined })} />)
    expect(screen.getByText("VIP")).toBeInTheDocument()
  })

  it("drops expired promotion flags while keeping a separately valid VIP period", () => {
    const listing = makeListing({ is_vip: true, is_promoted: true, is_featured: true,
      vip_until: "2026-10-20T00:00:00Z", promoted_until: "2026-10-18T00:00:00Z", featured_until: "invalid" })
    expect(refreshPromotion(listing, Date.parse("2026-10-19T00:00:00Z"))).toMatchObject({ is_vip: true, is_promoted: false, is_featured: false, promotion_tier: 1 })
  })
})
