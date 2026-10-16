import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

class CoverImage {
  static instances: CoverImage[] = []
  naturalWidth = 400
  naturalHeight = 200
  src = ""
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  removeAttribute = vi.fn()
  constructor() { CoverImage.instances.push(this) }
}

const draw = vi.fn()
const readPixels = vi.fn()
beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  CoverImage.instances = []
  draw.mockReset()
  readPixels.mockReset().mockReturnValue({ data: new Uint8ClampedArray([20, 70, 210, 255]) })
  vi.stubGlobal("Image", CoverImage)
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw, getImageData: readPixels } as unknown as CanvasRenderingContext2D)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("Browser cover sampling", () => {
  it("does not fetch untrusted image origins", async () => {
    const { readStoreCoverColor } = await import("@/lib/store-cover-color-client")
    expect(await readStoreCoverColor("https://untrusted.example/cover.png")).toBeNull()
    expect(CoverImage.instances).toHaveLength(0)
  })

  it("deduplicates a small same-origin thumbnail and limits canvas dimensions", async () => {
    const { readStoreCoverColor } = await import("@/lib/store-cover-color-client")
    const url = "https://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/public/store-branding/cover.png"
    const result = readStoreCoverColor(url)
    expect(readStoreCoverColor(url)).toBe(result)
    expect(CoverImage.instances).toHaveLength(1)
    const image = CoverImage.instances[0]
    expect(image.src).toBe(`/_next/image?url=${encodeURIComponent(url)}&w=256&q=75`)
    image.onload!()
    expect(await result).toEqual([20, 70, 210])
    expect(draw).toHaveBeenCalledWith(image, 0, 0, 32, 16)
    expect(readPixels).toHaveBeenCalledWith(0, 0, 32, 16)
  })

  it("falls back on canvas security errors and allows a later retry", async () => {
    const { readStoreCoverColor } = await import("@/lib/store-cover-color-client")
    readPixels.mockImplementationOnce(() => { throw new DOMException("Tainted canvas", "SecurityError") })
    const first = readStoreCoverColor("blob:retry")
    CoverImage.instances[0].onload!()
    expect(await first).toBeNull()
    const second = readStoreCoverColor("blob:retry")
    expect(CoverImage.instances).toHaveLength(2)
    CoverImage.instances[1].onload!()
    expect(await second).toEqual([20, 70, 210])
  })

  it("finishes safely on a broken image or a decoder timeout", async () => {
    const { readStoreCoverColor } = await import("@/lib/store-cover-color-client")
    const broken = readStoreCoverColor("blob:broken")
    CoverImage.instances[0].onerror!()
    expect(await broken).toBeNull()
    const pending = readStoreCoverColor("blob:timeout")
    await vi.advanceTimersByTimeAsync(8000)
    expect(await pending).toBeNull()
    expect(CoverImage.instances[1].onload).toBeNull()
  })
})
