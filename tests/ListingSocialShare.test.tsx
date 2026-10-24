import React from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import ListingSocialShare from "@/components/listings/ListingSocialShare"

describe("ListingSocialShare", () => {
  it("shows all social sharing actions immediately with recognizable labels", () => {
    render(
      <ListingSocialShare
        url="https://samosell.ge/listing/linen-jacket"
        title="Linen Jacket"
        text="Linen Jacket — 45,50 ₾"
        imageUrl={null}
        priceText="45,50 ₾"
      />,
    )

    expect(screen.getByRole("region", { name: "გაზიარება" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Instagram Story-ზე გაზიარება" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Facebook-ზე გაზიარება" })).toHaveAttribute(
      "href",
      expect.stringContaining("facebook.com/sharer/sharer.php"),
    )
    expect(screen.getByRole("link", { name: "WhatsApp-ში გაზიარება" })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me"),
    )
    expect(screen.getByRole("link", { name: "Telegram-ში გაზიარება" })).toHaveAttribute(
      "href",
      expect.stringContaining("t.me/share/url"),
    )
    expect(screen.getByRole("button", { name: "განცხადების ტექსტის კოპირება ჯგუფისთვის" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "სხვა აპში გაზიარება" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^გაზიარება$/ })).not.toBeInTheDocument()
  })

  it("copies a ready-to-paste post instead of a bare link", async () => {
    const writes: string[] = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { writes.push(value) } },
    })

    render(
      <ListingSocialShare
        url="https://samosell.ge/listing/palto-1234"
        title="ქალის პალტო"
        text={"ქალის პალტო · M\n45 ₾\nახალი · თბილისი"}
        imageUrl={null}
        priceText="45 ₾"
      />,
    )

    await userEvent.click(
      screen.getByRole("button", { name: "განცხადების ტექსტის კოპირება ჯგუფისთვის" }),
    )

    // Size, price, condition and city travel with the link so a seller only has
    // to paste once into a group.
    expect(writes[0]).toBe(
      "ქალის პალტო · M\n45 ₾\nახალი · თბილისი\n\nhttps://samosell.ge/listing/palto-1234",
    )
  })

  it("contains the Instagram Story 9:16 file sharing flow", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "listings", "ListingSocialShare.tsx"),
      "utf8",
    )

    expect(source).toContain("canvas.width = 1080")
    expect(source).toContain("canvas.height = 1920")
    expect(source).toContain("navigator.canShare({ files: [file] })")
    expect(source).toContain("new File([blob], \"samosell-instagram-story.png\"")
    expect(source).toContain("InstagramIcon")
    expect(source).toContain("FacebookIcon")
    expect(source).toContain("WhatsAppIcon")
    expect(source).toContain("TelegramIcon")
    expect(source).toContain("LinkIcon")
  })

  it("prebuilds the Story file and opens native file sharing directly when ready", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "listings", "ListingSocialShare.tsx"),
      "utf8",
    )

    expect(source).toContain("storyFileRef")
    expect(source).toContain("storyFilePromiseRef")
    expect(source).toContain("void prepareStoryFile().catch")
    expect(source).toContain("const sharePromise = navigator.share")
    expect(source).toContain("files: [cachedFile]")
  })
})
