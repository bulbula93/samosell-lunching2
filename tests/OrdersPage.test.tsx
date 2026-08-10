import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import DashboardOrdersPage from "@/app/dashboard/orders/page"

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/components/orders/OrderCard", () => ({
  default: ({ order, role }: { order: { id: string; listing_title: string }; role: string }) => (
    <article data-testid={`order-${order.id}`}>{order.listing_title} · {role}</article>
  ),
}))

const userId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const sellerId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"

function createSupabase(orders: Array<Record<string, unknown>>) {
  const builders: Array<{ eqCalls: Array<[string, unknown]>; orCalls: string[]; head: boolean }> = []

  const from = vi.fn(() => {
    const state = { eqCalls: [] as Array<[string, unknown]>, orCalls: [] as string[], head: false }
    builders.push(state)
    const builder = {
      select: vi.fn((_columns: string, config?: { head?: boolean }) => {
        state.head = Boolean(config?.head)
        return builder
      }),
      eq: vi.fn((column: string, value: unknown) => {
        state.eqCalls.push([column, value])
        return builder
      }),
      or: vi.fn((filter: string) => {
        state.orCalls.push(filter)
        return builder
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data?: Array<Record<string, unknown>>; count: number; error: null }) => void) => {
        resolve(state.head
          ? { count: orders.length, error: null }
          : { data: orders, count: orders.length, error: null })
      },
    }
    return builder
  })

  return { supabase: { from }, builders }
}

const order = {
  id: "377f3329-6c04-4c40-8f33-873ab3ee4f76",
  listing_id: "477f3329-6c04-4c40-8f33-873ab3ee4f76",
  buyer_id: userId,
  seller_id: sellerId,
  status: "paid",
  listing_title: "ტესტ შეკვეთა",
  listing_slug: "test-order",
  listing_cover_image_url: null,
  item_price: "100.00",
  delivery_price: "0.00",
  platform_fee: "0.00",
  buyer_protection_fee: "0.00",
  total_amount: "100.00",
  currency: "GEL",
  delivery_method: null,
  payment_provider: null,
  provider_status: null,
  created_at: "2026-08-10T15:00:00.000Z",
  updated_at: "2026-08-10T16:00:00.000Z",
}

describe("orders protected page", () => {
  beforeEach(() => vi.clearAllMocks())

  it("requires authentication before querying orders", async () => {
    mocks.requireAuthenticatedUser.mockRejectedValue(new Error("NEXT_REDIRECT"))
    await expect(DashboardOrdersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT")
  })

  it("derives participant scoping from the session and rejects query injection", async () => {
    const { supabase, builders } = createSupabase([order])
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: userId } })

    render(await DashboardOrdersPage({
      searchParams: Promise.resolve({ role: "seller_id=attacker", status: "buyer_id=attacker" }),
    }))

    expect(screen.getByTestId(`order-${order.id}`)).toHaveTextContent("ტესტ შეკვეთა · buyer")
    expect(builders.some((builder) => builder.orCalls.includes(`buyer_id.eq.${userId},seller_id.eq.${userId}`))).toBe(true)
    expect(JSON.stringify(builders)).not.toContain("attacker")
  })

  it("renders a truthful empty state without a fake checkout action", async () => {
    const { supabase } = createSupabase([])
    mocks.requireAuthenticatedUser.mockResolvedValue({ supabase, user: { id: userId } })

    render(await DashboardOrdersPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByRole("heading", { name: "შეკვეთები ჯერ არ გაქვს" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "კატალოგის ნახვა" })).toHaveAttribute("href", "/catalog")
    expect(screen.queryByRole("button", { name: /გადახდა|ყიდვა/ })).not.toBeInTheDocument()
  })
})
