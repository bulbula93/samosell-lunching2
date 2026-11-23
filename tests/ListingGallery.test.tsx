import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ListingGallery, {
  buildGalleryItems,
} from "@/components/listings/ListingGallery"
import { ka } from "@/lib/i18n/ka"

const firstImage =
  "https://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/public/listing-images/first.jpg"
const secondImage =
  "https://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/public/listing-images/second.jpg"

function visibleGalleryImage(name: RegExp) {
  return screen.getAllByRole("img", { name }).find((image) => image.getAttribute("loading") === "eager")
}

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
    const firstVisibleImage = visibleGalleryImage(/ატლასის კაბა.*1/)
    expect(firstVisibleImage).toBeInTheDocument()
    expect(firstVisibleImage).toHaveAttribute("loading", "eager")
    expect(firstVisibleImage).toHaveAttribute("fetchpriority", "high")
    expect(firstVisibleImage).not.toHaveClass("opacity-0")

    fireEvent.keyDown(tabs[0], { key: "ArrowRight" })

    expect(tabs[1]).toHaveFocus()
    expect(tabs[1]).toHaveAttribute("aria-selected", "true")
    expect(visibleGalleryImage(/ატლასის კაბა.*2/)).toBeInTheDocument()
  })

  it("is a native swipe carousel: all photos sit side by side and the scroll position selects the photo", async () => {
    render(
      <ListingGallery
        title="სვაიპის ტესტი"
        coverImageUrl={firstImage}
        images={[
          { id: "1", image_url: firstImage, sort_order: 1 },
          { id: "2", image_url: secondImage, sort_order: 2 },
        ]}
      />,
    )

    const track = screen.getByTestId("gallery-track")
    expect(track).toHaveClass("snap-x", "snap-mandatory", "overflow-x-auto")
    expect(track.children).toHaveLength(2)
    // The neighbour is already loading before the swipe reaches it.
    // (off-screen slides are aria-hidden, so look them up by alt text)
    expect(screen.getAllByAltText(/სვაიპის ტესტი.*2/).find((image) => image.getAttribute("loading") === "eager")).toBeTruthy()

    Object.defineProperty(track, "clientWidth", { configurable: true, value: 400 })
    track.scrollLeft = 400
    await act(async () => {
      fireEvent.scroll(track)
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    })

    expect(screen.getByText("2 / 2")).toBeInTheDocument()
    expect(track.children[0]).toHaveAttribute("aria-hidden", "true")
    expect(track.children[1]).not.toHaveAttribute("aria-hidden")
    expect(
      screen.getByText("ფოტოების სანახავად გადაუსვი მარცხნივ ან მარჯვნივ"),
    ).toBeInTheDocument()
  })

  it("arrow buttons scroll the track to the photo", () => {
    render(
      <ListingGallery
        title="ისრები"
        coverImageUrl={firstImage}
        images={[
          { id: "1", image_url: firstImage, sort_order: 1 },
          { id: "2", image_url: secondImage, sort_order: 2 },
        ]}
      />,
    )
    const track = screen.getByTestId("gallery-track")
    Object.defineProperty(track, "clientWidth", { configurable: true, value: 500 })
    const scrollTo = vi.fn()
    track.scrollTo = scrollTo as unknown as typeof track.scrollTo
    fireEvent.click(screen.getByRole("button", { name: ka.listingDetail.nextImage }))
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 500 }))
    expect(screen.getByText("2 / 2")).toBeInTheDocument()
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

  it("loads another photo after the selected photo fails", () => {
    render(
      <ListingGallery
        title="ფოტოს აღდგენა"
        coverImageUrl={firstImage}
        images={[
          { id: "1", image_url: firstImage, sort_order: 0 },
          { id: "2", image_url: secondImage, sort_order: 1 },
        ]}
      />,
    )

    fireEvent.error(visibleGalleryImage(/ფოტოს აღდგენა.*1/)!)
    expect(screen.getByText(ka.product.imageUnavailable)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: ka.listingDetail.nextImage }))

    // The broken first photo keeps its own fallback; the next photo still loads normally.
    expect(visibleGalleryImage(/ფოტოს აღდგენა.*2/)).toHaveAttribute("src", secondImage)
    expect(screen.getAllByText(ka.product.imageUnavailable)).toHaveLength(1)
    expect(screen.getByText("2 / 2")).toBeInTheDocument()
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

describe("ListingGallery photo action", () => {
  it("renders the favorite slot on the main photo when given", () => {
    render(
      <ListingGallery
        title="ქურთუკი"
        coverImageUrl={null}
        images={[]}
        photoAction={<button type="submit">რჩეულებში დამატება</button>}
      />,
    )
    const slot = screen.getByTestId("gallery-photo-action")
    expect(slot).toHaveClass("absolute", "right-3", "top-3")
    expect(within(slot).getByRole("button", { name: "რჩეულებში დამატება" })).toBeInTheDocument()
  })

  it("renders no slot without an action (owner or inactive listing)", () => {
    render(<ListingGallery title="ქურთუკი" coverImageUrl={null} images={[]} />)
    expect(screen.queryByTestId("gallery-photo-action")).toBeNull()
  })
})
