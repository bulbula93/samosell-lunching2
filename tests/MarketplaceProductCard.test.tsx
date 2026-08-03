import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import MarketplaceProductCard from "@/components/listings/MarketplaceProductCard"
import { ka } from "@/lib/i18n/ka"
import { makeListing } from "@/tests/fixtures"

describe("MarketplaceProductCard", () => {
  it("renders real listing fields, GEL price, fallback image, and favorite action", () => {
    render(<MarketplaceProductCard item={makeListing()} />)

    expect(screen.getByRole("heading", { name: /SAMO.*თეთრეულის ვინტაჟური ქურთუკი/ })).toBeInTheDocument()
    expect(screen.getByText("120 ₾")).toBeInTheDocument()
    expect(screen.getByText("თბილისი")).toBeInTheDocument()
    expect(screen.getByText(ka.product.imageUnavailable)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "რჩეულებში დამატება" })).toBeInTheDocument()
    for (const link of screen.getAllByRole("link", { name: /თეთრეულის ვინტაჟური ქურთუკი/ })) {
      expect(link).toHaveAttribute("href", "/listing/linen-jacket")
    }
  })

  it.each<[string, string]>([
    ["reserved", ka.product.reserved],
    ["sold", ka.product.sold],
  ])("renders %s state and removes the unavailable favorite action", (status, label) => {
    render(<MarketplaceProductCard item={makeListing({ status })} />)

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /რჩეულ/ })).not.toBeInTheDocument()
  })

  it("uses the safe fallback for an untrusted remote image", () => {
    render(
      <MarketplaceProductCard
        item={makeListing({ cover_image_url: "https://untrusted.example/listing.jpg" })}
      />,
    )

    expect(screen.getByText(ka.product.imageUnavailable)).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })
})
