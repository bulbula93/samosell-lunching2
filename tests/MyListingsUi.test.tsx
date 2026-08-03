import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ListingManagementCard from "@/components/dashboard/ListingManagementCard"
import ListingStatusControl from "@/components/dashboard/ListingStatusControl"
import MyListingsError from "@/app/dashboard/listings/error"
import MyListingsLoading from "@/app/dashboard/listings/loading"
import {
  canTransitionListingStatus,
  getMyListingsPath,
  parseMyListingsFilter,
} from "@/lib/my-listings"

const mocks = vi.hoisted(() => ({
  updateStatus: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock("@/app/dashboard/listings/actions", () => ({
  updateListingStatusAction: mocks.updateStatus,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

const baseItem = {
  id: "277f3329-6c04-4c40-8f33-873ab3ee4f76",
  title: "ძალიან გრძელი სატესტო სათაური, რომელიც ბარათის განლაგებას არ უნდა არღვევდეს",
  slug: "satesto-gancxadeba",
  price: "120.50",
  currency: "GEL",
  status: "active" as const,
  created_at: "2026-08-01T08:00:00.000Z",
  updated_at: "2026-08-04T08:00:00.000Z",
  cover_image_url: null,
  is_vip: false,
}

describe("my listings helpers and management UI", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("normalizes invalid filters and only exposes approved transition rules", () => {
    expect(parseMyListingsFilter("active")).toBe("active")
    expect(parseMyListingsFilter("seller_id=other-user")).toBe("all")
    expect(getMyListingsPath("reserved", 2)).toBe(
      "/dashboard/listings?status=reserved&page=2"
    )
    expect(canTransitionListingStatus("active", "sold")).toBe(true)
    expect(canTransitionListingStatus("active", "pending_review")).toBe(false)
    expect(canTransitionListingStatus("archived", "draft")).toBe(true)
    expect(canTransitionListingStatus("archived", "active")).toBe(false)
  })

  it("renders real management data, safe fallback and only supported actions", () => {
    render(<ListingManagementCard item={baseItem} />)

    expect(screen.getByRole("heading", { name: baseItem.title })).toBeInTheDocument()
    expect(screen.getByText("120,50 ₾")).toBeInTheDocument()
    expect(screen.getByText("სურათი არ არის")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ნახვა" })).toHaveAttribute(
      "href",
      `/listing/${baseItem.slug}`
    )
    expect(screen.getByRole("link", { name: "რედაქტირება" })).toHaveAttribute(
      "href",
      `/dashboard/listings/${baseItem.id}/edit`
    )
    expect(screen.queryByText(/წაშლა/)).not.toBeInTheDocument()
    expect(screen.queryByText(/checkout|payment|შეტყობინება/i)).not.toBeInTheDocument()
  })

  it("does not link a private archived listing to the public detail route", () => {
    render(<ListingManagementCard item={{ ...baseItem, status: "archived" }} />)

    expect(screen.getByText("არქივი")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "ნახვა" })).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: "დრაფტში დაბრუნება" })).toBeInTheDocument()
  })

  it("confirms a sold transition, waits for the server, then refreshes", async () => {
    const user = userEvent.setup()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    mocks.updateStatus.mockResolvedValue({
      ok: true,
      status: "sold",
      updatedAt: "2026-08-04T08:05:00.000Z",
      message: "განცხადება გაყიდულად მოინიშნა.",
    })

    render(
      <ListingStatusControl
        listingId={baseItem.id}
        listingTitle={baseItem.title}
        status="active"
        updatedAt={baseItem.updated_at}
      />
    )

    await user.selectOptions(
      screen.getByLabelText(`სტატუსის ახალი მნიშვნელობა — ${baseItem.title}`),
      "sold"
    )
    await user.click(screen.getByRole("button", { name: "შენახვა" }))

    expect(window.confirm).toHaveBeenCalledOnce()
    expect(mocks.updateStatus).toHaveBeenCalledWith({
      listingId: baseItem.id,
      nextStatus: "sold",
      expectedUpdatedAt: baseItem.updated_at,
    })
    expect(await screen.findByRole("status")).toHaveTextContent(
      "განცხადება გაყიდულად მოინიშნა."
    )
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it("blocks duplicate submission and announces a server failure", async () => {
    const user = userEvent.setup()
    let resolveAction:
      | ((value: {
          ok: false
          code: "server_error"
          message: string
        }) => void)
      | undefined
    mocks.updateStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve
      })
    )

    render(
      <ListingStatusControl
        listingId={baseItem.id}
        listingTitle={baseItem.title}
        status="active"
        updatedAt={baseItem.updated_at}
      />
    )

    await user.selectOptions(
      screen.getByLabelText(`სტატუსის ახალი მნიშვნელობა — ${baseItem.title}`),
      "reserved"
    )
    const button = screen.getByRole("button", { name: "შენახვა" })
    await user.click(button)
    await user.click(button)

    expect(mocks.updateStatus).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "ინახება…" })).toBeDisabled()

    resolveAction?.({
      ok: false,
      code: "server_error",
      message: "სტატუსი ვერ განახლდა.",
    })

    expect(await screen.findByRole("alert")).toHaveTextContent("სტატუსი ვერ განახლდა.")
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("announces loading and offers a private-safe error retry", async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    render(<MyListingsLoading />)
    expect(screen.getByRole("main", { name: "ჩემი განცხადებები იტვირთება" })).toHaveAttribute(
      "aria-busy",
      "true"
    )
    expect(screen.getByRole("status")).toHaveTextContent("ჩემი განცხადებები იტვირთება")

    render(<MyListingsError error={new Error("database raw detail")} reset={reset} />)
    expect(screen.getByRole("alert")).not.toHaveTextContent("database")
    await user.click(screen.getByRole("button", { name: "ხელახლა ცდა" }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
