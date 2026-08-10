import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import OrderCard from "@/components/orders/OrderCard"
import type { MarketplaceOrder } from "@/types/order"

vi.mock("@/app/dashboard/orders/actions", () => ({
  transitionMarketplaceOrderAction: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const order: MarketplaceOrder = {
  id: "377f3329-6c04-4c40-8f33-873ab3ee4f76",
  listing_id: "477f3329-6c04-4c40-8f33-873ab3ee4f76",
  buyer_id: "177f3329-6c04-4c40-8f33-873ab3ee4f76",
  seller_id: "277f3329-6c04-4c40-8f33-873ab3ee4f76",
  status: "paid",
  listing_title: "ქართული ტყავის ჩანთა",
  listing_slug: "kartuli-tyavis-chanta",
  listing_cover_image_url: null,
  item_price: "120.00",
  delivery_price: "5.00",
  platform_fee: "2.00",
  buyer_protection_fee: "1.50",
  total_amount: "128.50",
  currency: "GEL",
  delivery_method: null,
  payment_provider: null,
  provider_status: null,
  created_at: "2026-08-10T15:00:00.000Z",
  updated_at: "2026-08-10T16:00:00.000Z",
}

describe("order management card", () => {
  it("renders real snapshot amounts in GEL and a safe missing-image fallback", () => {
    render(<OrderCard order={order} role="buyer" />)

    expect(screen.getByRole("heading", { name: order.listing_title })).toBeInTheDocument()
    expect(screen.getByText("128,50 ₾")).toBeInTheDocument()
    expect(screen.getByText("120 ₾")).toBeInTheDocument()
    expect(screen.getByText("5 ₾")).toBeInTheDocument()
    expect(screen.getByText("სურათი აღარ არის ხელმისაწვდომი")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ნივთის ნახვა" })).toHaveAttribute(
      "href",
      "/listing/kartuli-tyavis-chanta",
    )
  })

  it("shows buyer and seller actions according to the real state machine", () => {
    const { rerender } = render(<OrderCard order={order} role="buyer" />)
    expect(screen.getByText("ვყიდულობ")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "დავის გახსნა" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "შეკვეთის დადასტურება" })).not.toBeInTheDocument()

    rerender(<OrderCard order={order} role="seller" />)
    expect(screen.getByText("ვყიდი")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "შეკვეთის დადასტურება" })).toBeInTheDocument()
  })
})
