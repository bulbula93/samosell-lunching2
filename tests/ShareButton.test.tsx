import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import ShareButton from "@/components/shared/ShareButton"
import { ka } from "@/lib/i18n/ka"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ShareButton", () => {
  it("announces successful Web Share completion", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    })

    render(
      <ShareButton
        url="https://samosell.ge/listing/linen-jacket"
        title="სელის ქურთუკი"
      />,
    )
    await userEvent.click(
      screen.getByRole("button", { name: ka.listingDetail.share }),
    )

    expect(share).toHaveBeenCalledWith({
      title: "სელის ქურთუკი",
      text: undefined,
      url: "https://samosell.ge/listing/linen-jacket",
    })
    expect(screen.getByRole("status")).toHaveTextContent(
      ka.listingDetail.shareComplete,
    )
  })

  it("copies the canonical URL when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <ShareButton
        url="https://samosell.ge/listing/linen-jacket"
        title="სელის ქურთუკი"
      />,
    )
    await userEvent.click(
      screen.getByRole("button", { name: ka.listingDetail.share }),
    )

    expect(writeText).toHaveBeenCalledWith(
      "https://samosell.ge/listing/linen-jacket",
    )
    expect(
      screen.getByRole("button", { name: ka.listingDetail.linkCopied }),
    ).toBeInTheDocument()
  })

  it("announces a safe error when sharing and clipboard are unavailable", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })

    render(
      <ShareButton
        url="https://samosell.ge/listing/linen-jacket"
        title="სელის ქურთუკი"
      />,
    )
    await userEvent.click(
      screen.getByRole("button", { name: ka.listingDetail.share }),
    )

    expect(
      screen.getByRole("status"),
    ).toHaveTextContent(ka.listingDetail.shareFailed)
  })
})
