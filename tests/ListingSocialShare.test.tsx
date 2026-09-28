import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import ListingSocialShare from "@/components/listings/ListingSocialShare"

describe("ListingSocialShare", () => {
  it("opens social sharing options from the product page share button", async () => {
    const user = userEvent.setup()
    render(
      <ListingSocialShare
        url="https://samosell.ge/listing/linen-jacket"
        title="Linen Jacket"
        text="Linen Jacket — 45,50 ₾"
        imageUrl={null}
        priceText="45,50 ₾"
      />,
    )

    const shareButton = screen.getByRole("button", { name: "გაზიარება" })
    expect(shareButton).toHaveAttribute("aria-expanded", "false")

    await user.click(shareButton)

    expect(shareButton).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: /Instagram Story/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Facebook" })).toHaveAttribute(
      "href",
      expect.stringContaining("facebook.com/sharer/sharer.php"),
    )
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me"),
    )
    expect(screen.getByRole("link", { name: "Telegram" })).toHaveAttribute(
      "href",
      expect.stringContaining("t.me/share/url"),
    )
    expect(screen.getByRole("button", { name: "ბმულის კოპირება" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "სხვა აპში" })).toBeInTheDocument()
  })

  it("contains the Instagram Story 9:16 file sharing flow", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "components", "listings", "ListingSocialShare.tsx"),
      "utf8",
    )

    expect(source).toContain("canvas.width = 1080")
    expect(source).toContain("canvas.height = 1920")
    expect(source).toContain("navigator.canShare({ files: [file] })")
    expect(source).toContain("new File([blob], \"samosell-instagram-story.png\"")
    expect(source).toContain("Link sticker")
  })
})
