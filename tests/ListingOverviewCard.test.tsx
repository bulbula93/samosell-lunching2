import React from "react"
import { render, screen, within } from "@testing-library/react"
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
    expect(screen.getAllByText("45,50 ₾").length).toBeGreaterThan(0)
    expect(screen.getByText("SS-A83F2C00")).toBeInTheDocument()
    expect(screen.getByText(/alert\('x'\)/)).toHaveTextContent("მეორე ხაზი")
    expect(document.querySelector("script")).not.toBeInTheDocument()
    expect(screen.getAllByText("ნინო").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: /3.*აქტიური ნივთები/ })).toHaveAttribute(
      "href",
      "/seller/nino#seller-listings",
    )
    expect(screen.queryByText(/ტელეფონი მითითებულია/)).not.toBeInTheDocument()
    expect(screen.queryByText(/SamoSell-ზე 1|SamoSell-ზე 2/)).not.toBeInTheDocument()
    expect(screen.queryByText(/წევრია:/)).not.toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: ka.listingDetail.loginToMessage }),
    ).toHaveAttribute("href", "/login?next=%2Flisting%2Flinen-jacket")
    expect(
      screen.getByRole("button", { name: /რჩეულებში დამატება/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("region", { name: ka.listingDetail.share })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /ნინო-ს ტელეფონის ნომრის ნახვა/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/\+995 555 000 000/)).not.toBeInTheDocument()
    expect(screen.queryByText("პირადი მისამართი")).not.toBeInTheDocument()
    expect(screen.queryByText(/4\.3|rating|checkout/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /ყიდვა|გადახდა/ })).not.toBeInTheDocument()
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

    expect(screen.getAllByText(label).length).toBeGreaterThan(0)
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
    expect(screen.queryByText("განცხადების დარეპორტება")).not.toBeInTheDocument()
    expect(screen.queryByText("მომხმარებლის დარეპორტება")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "მომხმარებლის დაბლოკვა" })).not.toBeInTheDocument()
    expect(screen.queryByText("უსაფრთხოდ იყიდე")).not.toBeInTheDocument()
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

  it("places the contact action before a long description and keeps search attribution in the login return path", () => {
    render(<ListingOverviewCard {...baseProps} listing={makeListing({ description: "გრძელი აღწერა ".repeat(200) })} searchId="search-review-1" />)
    const contact = screen.getByRole("region", { name: "დაუკავშირდი გამყიდველს" })
    const description = screen.getByRole("region", { name: ka.listingDetail.description })
    expect(contact.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(contact).getByRole("link", { name: ka.listingDetail.loginToMessage })).toHaveAttribute(
      "href", "/login?next=%2Flisting%2Flinen-jacket%3Fsearch_id%3Dsearch-review-1",
    )
    expect(within(contact).getByText("საჭიროა შესვლა")).toBeInTheDocument()
    expect(within(contact).getByRole("link", { name: "ნინო" })).toHaveAttribute("href", "/seller/nino")
  })

  it.each(["isBlocked", "isBlockedBySeller", "sellerSuspended"] as const)("does not offer messaging when %s is true", (restriction) => {
    render(<ListingOverviewCard {...baseProps} {...{ [restriction]: true }} isAuthenticated listing={makeListing()} />)
    expect(screen.queryByRole("button", { name: ka.listingDetail.messageSeller })).not.toBeInTheDocument()
    const contact = screen.getByRole("region", { name: "დაუკავშირდი გამყიდველს" })
    expect(within(contact).getByRole("button", { name: "მიუწვდომელია" })).toBeDisabled()
    expect(within(contact).getByRole("status")).toHaveTextContent(ka.listingDetail.messageUnavailable)
  })

  it.each(["sold", "reserved"])("offers other items for a %s listing without a chat or login action", (status) => {
    render(<ListingOverviewCard {...baseProps} listing={makeListing({ status })} />)
    const alternatives = screen.getByRole("region", { name: "ნახე სხვა ნივთები" })
    expect(within(alternatives).getByRole("link", { name: "სხვა ნივთების ნახვა" })).toHaveAttribute("href", "/catalog")
    expect(screen.queryByRole("link", { name: ka.listingDetail.loginToMessage })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: ka.listingDetail.messageSeller })).not.toBeInTheDocument()
  })
})

describe("ListingOverviewCard — readable layout", () => {
  it("shows size, condition and city as chips under the price, and the description before the details", () => {
    render(
      <ListingOverviewCard
        {...baseProps}
        listing={makeListing({ description: "მოკლე აღწერა", size_label: "38", condition: "new", city: "ბათუმი", category_slug: "women", category_name: "ქალებისთვის", gender: "women" })}
      />,
    )
    const facts = screen.getByRole("list", { name: "მთავარი ინფორმაცია" })
    expect(within(facts).getByText(/38/)).toBeInTheDocument()
    expect(within(facts).getByText(/ბათუმი/)).toBeInTheDocument()

    const description = screen.getByRole("heading", { name: ka.listingDetail.description })
    const details = screen.getByRole("heading", { name: ka.listingDetail.details })
    expect(description.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // "განყოფილება: ქალი" repeats "კატეგორია: ქალებისთვის"
    expect(screen.queryByText(ka.listingDetail.section)).not.toBeInTheDocument()
    // short description: no collapse control
    expect(screen.queryByText("სრულად წაკითხვა")).not.toBeInTheDocument()
  })

  it("collapses long descriptions with a no-JS toggle", () => {
    render(<ListingOverviewCard {...baseProps} listing={makeListing({ description: "ძალიან კარგი ნივთი. ".repeat(30) })} />)
    expect(screen.getByText("სრულად წაკითხვა").tagName).toBe("LABEL")
    expect(document.getElementById("listing-description-toggle")).toHaveAttribute("type", "checkbox")
  })

  it("keeps the gender row when the category does not imply it", () => {
    render(<ListingOverviewCard {...baseProps} listing={makeListing({ category_slug: "footwear", category_name: "ფეხსაცმელი", gender: "kids" })} />)
    expect(screen.getByText(ka.listingDetail.section)).toBeInTheDocument()
  })
})

describe("ListingOverviewCard — contact card on phones", () => {
  it("keeps the action bar but hides the duplicate contact card chrome below md", () => {
    render(<ListingOverviewCard {...baseProps} listing={makeListing({})} />)
    const heading = screen.getByRole("heading", { name: "დაუკავშირდი გამყიდველს" })
    expect(heading.className).toContain("sr-only")
    expect(heading.className).toContain("md:not-sr-only")
    const section = heading.closest("section")!
    expect(section.className).not.toMatch(/(^|\s)(border|rounded-2xl|p-4)(\s|$)/)
    expect(section.className).toContain("md:border")
    const terms = screen.getByText(/ნივთის მიღებისა და გადახდის პირობები/).className.split(/\s+/)
    expect(terms).toEqual(expect.arrayContaining(["hidden", "md:block"]))
    // the action itself is still rendered (pinned bar on phones)
    expect(screen.getByRole("link", { name: ka.listingDetail.loginToMessage })).toBeInTheDocument()
  })
  describe("description card", () => {
    const listing = () => makeListing({ description: "მოკლე აღწერა" })
    const askButton = () => within(screen.getByTestId("listing-description")).queryByText("კითხვა გამყიდველს")

    it("shows a chat button for signed-in buyers", () => {
      render(<ListingOverviewCard {...baseProps} isAuthenticated canChat listing={listing()} />)
      expect(askButton()?.tagName).toBe("BUTTON")
    })

    it("sends guests to login and back to the listing", () => {
      render(<ListingOverviewCard {...baseProps} listing={listing()} />)
      const link = askButton()?.closest("a")
      expect(link?.getAttribute("href")).toMatch(/^\/login\?next=/)
    })

    it("hides the button for the owner", () => {
      render(<ListingOverviewCard {...baseProps} isOwner isAuthenticated canChat listing={listing()} />)
      expect(askButton()).toBeNull()
    })

    it("hides the button when the seller cannot be messaged", () => {
      render(<ListingOverviewCard {...baseProps} isAuthenticated canChat={false} listing={listing()} />)
      expect(askButton()).toBeNull()
    })

    it("hides the button on inactive listings", () => {
      render(<ListingOverviewCard {...baseProps} isAuthenticated canChat listing={makeListing({ description: "x", status: "sold" })} />)
      expect(askButton()).toBeNull()
    })
  })
})
