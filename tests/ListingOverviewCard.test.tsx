import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ListingOverviewCard from "@/components/listings/ListingOverviewCard"
import { ka } from "@/lib/i18n/ka"
import { makeListing } from "@/tests/fixtures"

vi.mock("@/components/chat/StartChatButton", () => ({
  default: ({ label }: { label: string }) =>
    React.createElement("button", { type: "submit" }, label),
}))

const baseProps = {
  sellerProfile: {
    username: "nino",
    full_name: "ნინო",
    city: "თბილისი",
    created_at: "2025-02-01T00:00:00.000Z",
    avatar_url: null,
    store_phone: "+995 555 000 000",
    store_address: "პირადი მისამართი",
  },
  sellerLabel: "ნინო",
  sellerAvatarSrc: null,
  sellerActiveListingsCount: 3,
  isOwner: false,
  isAuthenticated: false,
  canChat: false,
  isFavorited: false,
  chatError: "",
  favoriteError: "",
  reportFlash: "",
  isBlocked: false,
  isBlockedBySeller: false,
  sellerSuspended: false,
  shareUrl: "https://samosell.ge/listing/linen-jacket",
}

describe("ListingOverviewCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("renders real public fields, GEL price, safe text, and anonymous actions", () => {
    const description = "<script>alert('x')</script>\nმეორე ხაზი"
    render(
      <ListingOverviewCard
        {...baseProps}
        listing={makeListing({
          description,
          price: 45.5,
          color: "შავი",
          material: "ატლასი",
          gender: "women",
          published_at: "2026-07-13T15:19:00.000Z",
        })}
      />,
    )

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      makeListing().title,
    )
    expect(screen.getByText("45,50 ₾")).toBeInTheDocument()
    expect(screen.getByText(/alert\('x'\)/)).toHaveTextContent("მეორე ხაზი")
    expect(document.querySelector("script")).not.toBeInTheDocument()
    expect(screen.getByText("ნინო")).toBeInTheDocument()
    expect(screen.getByText(/3.*აქტიური ნივთები/)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: ka.listingDetail.loginToMessage }),
    ).toHaveAttribute("href", "/login?next=%2Flisting%2Flinen-jacket")
    expect(
      screen.getByRole("button", { name: /რჩეულებში დამატება/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: ka.listingDetail.share })).toBeInTheDocument()
    expect(screen.queryByText("+995 555 000 000")).not.toBeInTheDocument()
    expect(screen.queryByText("პირადი მისამართი")).not.toBeInTheDocument()
    expect(screen.queryByText(/4\.3|rating|checkout|ყიდვა/i)).not.toBeInTheDocument()
  })

  it("omits missing optional fields instead of inventing placeholders", () => {
    render(
      <ListingOverviewCard
        {...baseProps}
        sellerProfile={null}
        sellerActiveListingsCount={0}
        listing={makeListing({
          description: null,
          brand_name: null,
          size_label: null,
          color: null,
          material: null,
          gender: null,
          city: null,
          published_at: null,
          views_count: 0,
          favorites_count: 0,
        })}
      />,
    )

    expect(
      screen.queryByRole("heading", { name: ka.listingDetail.description }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("უცნობია")).not.toBeInTheDocument()
  })

  it.each([
    ["reserved", ka.listingDetail.reserved, ka.listingDetail.reservedMessage],
    ["sold", ka.listingDetail.sold, ka.listingDetail.soldMessage],
  ])("renders the %s owner state without purchase or messaging actions", (status, label, message) => {
    render(
      <ListingOverviewCard
        {...baseProps}
        isOwner
        isAuthenticated
        listing={makeListing({ status })}
      />,
    )

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: ka.listingDetail.edit }),
    ).toHaveAttribute("href", "/dashboard/listings/listing-1/edit")
    expect(screen.queryByText(ka.listingDetail.messageSeller)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /რჩეულ/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/checkout|ყიდვა/i)).not.toBeInTheDocument()
  })

  it("shows the real messaging action only for an authorized authenticated viewer", () => {
    render(
      <ListingOverviewCard
        {...baseProps}
        isAuthenticated
        canChat
        listing={makeListing({ seller_id: "seller-1" })}
      />,
    )

    expect(
      screen.getByRole("button", { name: ka.listingDetail.messageSeller }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: ka.listingDetail.loginToMessage }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("განცხადების დარეპორტება")).toBeInTheDocument()
    expect(screen.getByText("მომხმარებლის დარეპორტება")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "მომხმარებლის დაბლოკვა" }),
    ).toBeInTheDocument()
  })

  it("does not show report or block mutations to the listing owner", () => {
    render(
      <ListingOverviewCard
        {...baseProps}
        isOwner
        isAuthenticated
        listing={makeListing({ seller_id: "seller-1" })}
      />,
    )

    expect(screen.queryByText("განცხადების დარეპორტება")).not.toBeInTheDocument()
    expect(screen.queryByText("მომხმარებლის დარეპორტება")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "მომხმარებლის დაბლოკვა" }),
    ).not.toBeInTheDocument()
  })

  it("announces a favorite mutation failure without optimistic state", () => {
    render(
      <ListingOverviewCard
        {...baseProps}
        favoriteError={ka.listingDetail.favoriteFailed}
        listing={makeListing()}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      ka.listingDetail.favoriteFailed,
    )
  })

  it("keeps long user text inside breakable content regions", () => {
    const longTitle = "ძალიანგრძელისათაური".repeat(30)
    const longDescription = "https://example.com/".repeat(60)
    render(
      <ListingOverviewCard
        {...baseProps}
        listing={makeListing({ title: longTitle, description: longDescription })}
      />,
    )

    expect(screen.getByRole("heading", { level: 1 })).toHaveClass("break-words")
    expect(screen.getByText(longDescription)).toHaveClass("break-words")
  })
})
