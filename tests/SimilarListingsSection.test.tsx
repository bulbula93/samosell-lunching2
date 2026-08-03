import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import SimilarListingsSection from "@/components/listings/SimilarListingsSection"
import { ka } from "@/lib/i18n/ka"
import { makeListing } from "@/tests/fixtures"

describe("SimilarListingsSection", () => {
  it("reuses marketplace product cards for real related items", () => {
    render(
      <SimilarListingsSection
        listingSlug="current-listing"
        favoriteIds={["related-2"]}
        similarItems={[
          makeListing({ id: "related-1", slug: "related-one", title: "პირველი" }),
          makeListing({ id: "related-2", slug: "related-two", title: "მეორე" }),
        ]}
      />,
    )

    expect(
      screen.getByRole("heading", { name: ka.listingDetail.similar }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /პირველი/ }),
    ).toHaveAttribute("href", "/listing/related-one")
    expect(
      screen.getByRole("link", { name: /მეორე/ }),
    ).toHaveAttribute("href", "/listing/related-two")
  })

  it("renders no empty section when no related items exist", () => {
    const { container } = render(
      <SimilarListingsSection
        listingSlug="current-listing"
        favoriteIds={[]}
        similarItems={[]}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
