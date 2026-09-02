import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import DashboardListingsPage from "@/app/dashboard/listings/page"

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

vi.mock("@/components/dashboard/ListingManagementCard", () => ({
  default: ({ item }: { item: { id: string; title: string } }) => (
    <article data-testid={`listing-${item.id}`}>{item.title}</article>
  ),
}))

const ownerId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"

type BuilderState = {
  head: boolean
  filter: string
  publicId: string
  eqCalls: Array<[string, unknown]>
}

function createSupabase(options: {
  listings?: Array<Record<string, unknown>>
  counts?: Partial<Record<string, number>>
}) {
  const builders: BuilderState[] = []
  const listings = options.listings ?? []
  const counts = options.counts ?? {}

  const from = vi.fn(() => {
    const state: BuilderState = { head: false, filter: "all", publicId: "", eqCalls: [] }
    builders.push(state)

    const builder = {
      select: vi.fn((_columns: string, config?: { head?: boolean }) => {
        state.head = Boolean(config?.head)
        return builder
      }),
      eq: vi.fn((column: string, value: unknown) => {
        state.eqCalls.push([column, value])
        if (column === "status") state.filter = String(value)
        if (column === "public_id") state.publicId = String(value)
        return builder
      }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      then: (
        resolve: (value: {
          data?: Array<Record<string, unknown>>
          count: number
          error: null
        }) => void
      ) => {
        if (state.head) {
          resolve({
            count: counts[state.filter] ?? (state.filter === "all" ? listings.length : 0),
            error: null,
          })
          return
        }

        const statusFiltered =
          state.filter === "all"
            ? listings
            : listings.filter((item) => item.status === state.filter)
        const filtered = state.publicId
          ? statusFiltered.filter((item) => item.public_id === state.publicId)
          : statusFiltered
        resolve({
          data: filtered,
          count: counts[state.filter] ?? filtered.length,
          error: null,
        })
      },
    }

    return builder
  })

  return { supabase: { from }, builders }
}

const listing = {
  id: "277f3329-6c04-4c40-8f33-873ab3ee4f76",
  public_id: "SS-277F3329",
  title: "ჩემი ქურთუკი",
  slug: "chemi-kurtuki",
  price: "120.00",
  currency: "GEL",
  status: "active",
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-04T08:00:00.000Z",
  cover_image_url: null,
  is_vip: false,
  is_promoted: false,
  is_featured: false,
  vip_until: null,
  promoted_until: null,
  featured_until: null,
  featured_slot: null,
}

describe("my listings protected page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires authentication before rendering the route", async () => {
    mocks.requireAuthenticatedUser.mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(
      DashboardListingsPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("NEXT_REDIRECT")
  })

  it("derives the owner from the session and filters at query time", async () => {
    const { supabase, builders } = createSupabase({
      listings: [listing],
      counts: { all: 1, active: 1 },
    })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase,
      user: { id: ownerId },
    })

    render(
      await DashboardListingsPage({
        searchParams: Promise.resolve({ status: "seller_id=attacker" }),
      })
    )

    expect(screen.getByTestId(`listing-${listing.id}`)).toHaveTextContent("ჩემი ქურთუკი")
    expect(screen.getByRole("link", { name: /ყველა\s*1/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      builders.every((builder) =>
        builder.eqCalls.some(
          ([column, value]) => column === "seller_id" && value === ownerId
        )
      )
    ).toBe(true)
    expect(
      builders.some((builder) =>
        builder.eqCalls.some(([, value]) => value === "attacker")
      )
    ).toBe(false)
  })

  it("distinguishes a filtered empty state from an empty account", async () => {
    const { supabase } = createSupabase({
      listings: [],
      counts: { all: 2, reserved: 0 },
    })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase,
      user: { id: ownerId },
    })

    render(
      await DashboardListingsPage({
        searchParams: Promise.resolve({ status: "reserved" }),
      })
    )

    expect(
      screen.getByRole("heading", { name: "ამ სტატუსით განცხადება არ არის" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ყველა განცხადება" })).toHaveAttribute(
      "href",
      "/dashboard/listings"
    )
  })

  it("searches only the signed-in seller rows by normalized public ID", async () => {
    const { supabase, builders } = createSupabase({
      listings: [listing],
      counts: { all: 1, active: 1 },
    })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase,
      user: { id: ownerId },
    })

    render(
      await DashboardListingsPage({
        searchParams: Promise.resolve({ q: "ss-277f3329" }),
      }),
    )

    expect(screen.getByTestId(`listing-${listing.id}`)).toBeInTheDocument()
    expect(
      builders.some((builder) =>
        builder.eqCalls.some(
          ([column, value]) => column === "public_id" && value === "SS-277F3329",
        ),
      ),
    ).toBe(true)
    expect(
      builders.every((builder) =>
        builder.eqCalls.some(
          ([column, value]) => column === "seller_id" && value === ownerId,
        ),
      ),
    ).toBe(true)
  })
})
