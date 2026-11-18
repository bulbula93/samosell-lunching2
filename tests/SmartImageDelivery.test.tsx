import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SmartImage from "@/components/shared/SmartImage"
import { ka } from "@/lib/i18n/ka"

// Exercise Next/Image's real URL generation, rather than the global img mock.
vi.mock("next/image", async () => vi.importActual("next/image"))

const storagePath = "/storage/v1/object/public/listing-images/seller/listing/photo.webp"
const productionImage = `https://lxsvjzbiuewgwpajqrwr.supabase.co${storagePath}`

afterEach(() => vi.unstubAllEnvs())

describe("SmartImage delivery", () => {
  it("serves the photo and its backdrop directly from public Storage", () => {
    const { container } = render(
      <SmartImage src={productionImage} alt="ფეხსაცმელი" fit="contain" backdrop />,
    )

    const images = container.querySelectorAll("img")
    expect(images).toHaveLength(2)
    for (const image of images) {
      expect(image).toHaveAttribute("src", productionImage)
      expect(image).not.toHaveAttribute("srcset")
    }
  })

  it("also serves uploads from the configured QA Storage project directly", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ydocqjdjmffysexkzxyc.supabase.co")
    const qaImage = `https://ydocqjdjmffysexkzxyc.supabase.co${storagePath}`
    render(<SmartImage src={qaImage} alt="QA ფოტო" />)

    expect(screen.getByRole("img")).toHaveAttribute("src", qaImage)
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
