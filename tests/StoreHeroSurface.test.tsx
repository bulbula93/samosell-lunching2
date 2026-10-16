import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import StoreHeroSurface from "@/components/stores/StoreHeroSurface"
import StoreHeroEditorDemo from "@/components/stores/StoreHeroEditorDemo"
import { createStoreCoverTheme, DEFAULT_STORE_COVER_THEME, type CoverRgb } from "@/lib/store-cover-theme"

const { readColor } = vi.hoisted(() => ({ readColor: vi.fn() }))
vi.mock("@/lib/store-cover-color-client", () => ({ readStoreCoverColor: readColor }))

beforeEach(() => { readColor.mockReset().mockResolvedValue(null) })

describe("Adaptive storefront surface", () => {
  it("renders readable content without an image or canvas result", () => {
    render(<StoreHeroSurface aria-label="store"><h1>ჩემი მაღაზია</h1></StoreHeroSurface>)
    expect(screen.getByRole("heading")).toHaveTextContent("ჩემი მაღაზია")
    expect(screen.getByRole("region")).toHaveAttribute("data-store-cover-theme", "default")
    expect(readColor).not.toHaveBeenCalled()
  })

  it("changes the background after the cover is decoded", async () => {
    readColor.mockResolvedValue([20, 70, 210])
    render(<StoreHeroSurface aria-label="store" coverUrl="blob:blue" />)
    await waitFor(() => expect(screen.getByRole("region")).toHaveAttribute("data-store-cover-theme", "image"))
    expect(screen.getByRole("region")).toHaveStyle({ backgroundImage: createStoreCoverTheme([20, 70, 210]).backgroundImage })
  })

  it("ignores an old cover that finishes decoding after its replacement", async () => {
    let resolveOld!: (value: CoverRgb) => void
    readColor.mockReturnValueOnce(new Promise<CoverRgb>(resolve => { resolveOld = resolve })).mockResolvedValueOnce([220, 80, 40])
    const { rerender } = render(<StoreHeroSurface aria-label="store" coverUrl="blob:old" />)
    rerender(<StoreHeroSurface aria-label="store" coverUrl="blob:new" />)
    await waitFor(() => expect(screen.getByRole("region")).toHaveAttribute("data-store-cover-theme", "image"))
    const currentBackground = screen.getByRole("region").style.backgroundImage
    await act(async () => { resolveOld([20, 70, 210]) })
    expect(screen.getByRole("region").style.backgroundImage).toBe(currentBackground)
  })

  it("falls back immediately when the cover is removed or unreadable", async () => {
    readColor.mockResolvedValueOnce([20, 70, 210]).mockResolvedValue(null)
    const { rerender } = render(<StoreHeroSurface aria-label="store" coverUrl="blob:blue" />)
    await waitFor(() => expect(screen.getByRole("region")).toHaveAttribute("data-store-cover-theme", "image"))
    rerender(<StoreHeroSurface aria-label="store" />)
    expect(screen.getByRole("region")).toHaveAttribute("data-store-cover-theme", "default")
    expect(screen.getByRole("region")).toHaveStyle({ backgroundImage: DEFAULT_STORE_COVER_THEME.backgroundImage })
    rerender(<StoreHeroSurface aria-label="store" coverUrl="blob:broken" />)
    await waitFor(() => expect(readColor).toHaveBeenCalledWith("blob:broken"))
    expect(screen.getByRole("region")).toHaveAttribute("data-store-cover-theme", "default")
  })

  it("keeps the selected cover alive when a logo is added", async () => {
    const createUrl = vi.fn().mockReturnValueOnce("blob:selected-cover").mockReturnValueOnce("blob:selected-logo")
    const revokeUrl = vi.fn()
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    URL.createObjectURL = createUrl
    URL.revokeObjectURL = revokeUrl
    try {
      const user = userEvent.setup()
      const { unmount } = render(<StoreHeroEditorDemo />)
      await user.upload(screen.getByLabelText("დემო ქავერის ფოტო"), new File(["cover"], "cover.png", { type: "image/png" }))
      await user.upload(screen.getByLabelText("დემო მაღაზიის ლოგო"), new File(["logo"], "logo.png", { type: "image/png" }))
      expect(revokeUrl).not.toHaveBeenCalledWith("blob:selected-cover")
      unmount()
      expect(revokeUrl).toHaveBeenCalledWith("blob:selected-cover")
      expect(revokeUrl).toHaveBeenCalledWith("blob:selected-logo")
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })
})
