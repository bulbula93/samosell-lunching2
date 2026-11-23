import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { storyFile, create } = vi.hoisted(() => {
  const storyFile = new File(["x"], "samosell-instagram-story.png", { type: "image/png" })
  return { storyFile, create: vi.fn(async () => storyFile) }
})
vi.mock("@/lib/share/story-image", async (orig) => {
  const real = await orig<typeof import("@/lib/share/story-image")>()
  return { ...real, createInstagramStoryFile: create, triggerFileDownload: vi.fn() }
})
vi.mock("qrcode", () => ({ toDataURL: vi.fn(async () => "data:image/png;base64,QR") }))

import ShareAfterPublishDialog, { SHARE_PROMPT_KEY } from "@/components/listings/ShareAfterPublishDialog"
import { facebookShareUrl, withShareUtm } from "@/lib/share/story-image"

const props = { listingId: "11111111-1111-4111-8111-111111111111", listingUrl: "https://samosell.ge/listing/zara-kaba-1a2b", title: "Zara-ს კაბა", priceText: "45 ₾", imageUrl: null }

async function openDialog() {
  render(<ShareAfterPublishDialog {...props} />)
  await act(async () => { vi.advanceTimersByTime(700) })
}

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); create.mockClear() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("share links", () => {
  it("adds seller_share UTM per channel and builds the Facebook sharer link", () => {
    const u = new URL(withShareUtm(props.listingUrl, "facebook"))
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: "facebook", utm_medium: "seller_share", utm_campaign: "post_publish" })
    expect(facebookShareUrl("https://samosell.ge/a?b=1")).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fsamosell.ge%2Fa%3Fb%3D1")
  })
})

describe("ShareAfterPublishDialog", () => {
  it("opens after publish with Instagram, Facebook and copy options and the real logo", async () => {
    await openDialog()
    expect(screen.getByRole("dialog", { name: "განცხადება გამოქვეყნდა!" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Instagram Story-ში გაზიარება/ })).toBeInTheDocument()
    const fb = screen.getByRole("link", { name: /Facebook-ზე გაზიარება/ })
    expect(fb).toHaveAttribute("href", facebookShareUrl(withShareUtm(props.listingUrl, "facebook")))
    expect(fb).toHaveAttribute("target", "_blank")
    expect(screen.getAllByAltText("Samo$ell")[0]).toHaveAttribute("src", "/brand/samosell-header-logo.svg")
    expect(create).toHaveBeenCalledWith({ title: props.title, priceText: "45 ₾", imageUrl: null })
  })

  it("“later” closes it and it never opens again for the same listing", async () => {
    await openDialog()
    fireEvent.click(screen.getByRole("button", { name: "მოგვიანებით" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(localStorage.getItem(SHARE_PROMPT_KEY(props.listingId))).toBe("1")
    render(<ShareAfterPublishDialog {...props} />)
    await act(async () => { vi.advanceTimersByTime(700) })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("Escape closes it", async () => {
    await openDialog()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("on a phone it opens the share sheet with the Story image and shows the 3 steps", async () => {
    const share = vi.fn(async () => undefined)
    vi.stubGlobal("navigator", { ...navigator, share, canShare: () => true, clipboard: { writeText: vi.fn(async () => undefined) } })
    await openDialog()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Instagram Story-ში/ })) })
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [storyFile] }))
    expect(screen.getByText("Instagram-ში 3 ნაბიჯი")).toBeInTheDocument()
    expect(localStorage.getItem(SHARE_PROMPT_KEY(props.listingId))).toBe("1")
  })

  it("on a computer it shows a QR to continue on the phone and a download", async () => {
    vi.stubGlobal("navigator", { ...navigator, share: undefined, canShare: undefined, clipboard: { writeText: vi.fn(async () => undefined) } })
    await openDialog()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Instagram Story-ში/ })) })
    expect(screen.getByText(/კომპიუტერიდან Instagram გაზიარებას არ იძლევა/)).toBeInTheDocument()
    expect(screen.getByAltText(/QR კოდი/)).toHaveAttribute("src", "data:image/png;base64,QR")
    expect(screen.getByRole("button", { name: "Story-ის სურათის ჩამოტვირთვა" })).toBeInTheDocument()
  })
})
