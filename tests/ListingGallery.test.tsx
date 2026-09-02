import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import ListingGallery, {
  buildGalleryItems,
} from "@/components/listings/ListingGallery"
import { ka } from "@/lib/i18n/ka"

const firstImage =
  "https://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/public/listing-images/first.jpg"
const secondImage =
  "https://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/public/listing-images/second.jpg"

describe("ListingGallery", () => {
  it("deduplicates real images and supports thumbnail keyboard navigation", () => {
    render(
      <ListingGallery
        title="ატლასის კაბა"
        coverImageUrl={firstImage}
        images={[
          { id: "2", image_url: secondImage, sort_order: 2 },
          { id: "1", image_url: firstImage, sort_order: 1 },
        ]}
      />,
    )

    const tabs = screen.getAllByRole("tab")
    expect(tabs).toHaveLength(2)
    expect(tabs[0]).toHaveAttribute("aria-selected", "true")
    const firstVisibleImage = screen.getByRole("img", { name: /ატლასის კაბა.*1/ })
    expect(firstVisibleImage).toBeInTheDocument()
    expect(firstVisibleImage).toHaveAttribute("loading", "eager")
    expect(firstVisibleImage).toHaveAttribute("fetchpriority", "high")
    expect(firstVisibleImage).not.toHaveClass("opacity-0")

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" })

    expect(tabs[1]).toHaveFocus()
    expect(tabs[1]).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("img", { name: /ატლასის კაბა.*2/ })).toBeInTheDocument()
  })

  it("uses a stable fallback when images are missing or untrusted", () => {
    render(
      <ListingGallery
        title="ნივთი ფოტოს გარეშე"
        coverImageUrl="https://untrusted.example/image.jpg"
        images={[]}
      />,
    )

    expect(screen.getByText(ka.product.imageUnavailable)).toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  })

  it("sorts images without mutating the original array", () => {
    const images = [
      { id: "later", image_url: secondImage, sort_order: 5 },
      { id: "first", image_url: firstImage, sort_order: 1 },
    ]

    expect(buildGalleryItems(null, images).map((item) => item.id)).toEqual([
      "first",
      "later",
    ])
    expect(images.map((item) => item.id)).toEqual(["later", "first"])
  })
})
