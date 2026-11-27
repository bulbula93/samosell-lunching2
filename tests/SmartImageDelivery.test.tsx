import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SmartImage from "@/components/shared/SmartImage"
import { ka } from "@/lib/i18n/ka"

// Exercise Next/Image's real URL generation, rather than the global img mock.
vi.mock("next/image", async () => vi.importActual("next/image"))

const storagePath = "/storage/v1/object/public/listing-images/seller/listing/photo.webp"
const productionImage = `https://lxsvjzbiuewgwpajqrwr.supabase.co${storagePath}`

afterEach(() => vi.unstubAllEnvs())

describe("SmartImage delivery", () => {
  it("serves Storage photos and their backdrop through the image optimizer", () => {
    const { container } = render(
      <SmartImage src={productionImage} alt="ფეხსაცმელი" fit="contain" backdrop />,
    )

    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(2)
    for (const image of images) {
      const url = new URL(image.getAttribute("src")!, "https://samosell.ge")
      expect(url.pathname).toBe("/_next/image")
      expect(url.searchParams.get("url")).toBe(productionImage)
      expect(image).toHaveAttribute("srcset")
    }
  })

  it("falls back to the original Storage URL when the optimizer fails", () => {
    render(<SmartImage src={productionImage} alt="ფეხსაცმელი" />)

    fireEvent.error(screen.getByRole("img"))

    expect(screen.getByRole("img")).toHaveAttribute("src", productionImage)
    expect(screen.queryByText(ka.product.imageUnavailable)).not.toBeInTheDocument()
  })

  it("shows the placeholder only when the original also fails", () => {
    render(<SmartImage src={productionImage} alt="ფეხსაცმელი" />)

    fireEvent.error(screen.getByRole("img"))
    fireEvent.error(screen.getByRole("img"))

    expect(screen.getByText(ka.product.imageUnavailable)).toBeInTheDocument()
  })

  it("still accepts uploads from the configured QA Storage project", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ydocqjdjmffysexkzxyc.supabase.co")
    const qaImage = `https://ydocqjdjmffysexkzxyc.supabase.co${storagePath}`
    render(<SmartImage src={qaImage} alt="QA ფოტო" />)

    const url = new URL(screen.getByRole("img").getAttribute("src")!, "https://samosell.ge")
    expect(url.searchParams.get("url")).toBe(qaImage)
  })

  it("retains optimized responsive URLs for bundled site assets", () => {
    render(<SmartImage src="/brand/samosell-promo-bg.jpg" alt="ბანერი" />)

    const url = new URL(screen.getByRole("img").getAttribute("src")!, "https://samosell.ge")
    expect(url.pathname).toBe("/_next/image")
    expect(screen.getByRole("img")).toHaveAttribute("srcset")
  })

  it.each([
    "https://untrusted.example/photo.webp",
    "https://otherprojectabcdefgh.supabase.co/storage/v1/object/public/listing-images/photo.webp",
    "https://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/sign/listing-images/private.webp",
  ])("still rejects an untrusted or private image: %s", (src) => {
    render(<SmartImage src={src} alt="დაუშვებელი ფოტო" />)

    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByText(ka.product.imageUnavailable)).toBeInTheDocument()
  })
})
