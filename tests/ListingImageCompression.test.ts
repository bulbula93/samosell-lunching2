import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  LISTING_IMAGE_MAX_DIMENSION,
  prepareListingImageForUpload,
} from "@/lib/listing-image-compression"

const MB = 1024 * 1024

function makeFile(size: number, type = "image/jpeg", name = "IMG_0001.JPG") {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1_700_000_000_000 })
}

type EncoderBehaviour = Record<string, { type: string; size: number } | null>

let drawn: { width: number; height: number } | null
let closeSpy: ReturnType<typeof vi.fn>

function installBrowserImageApis(bitmap: { width: number; height: number }, encoder: EncoderBehaviour) {
  closeSpy = vi.fn()
  drawn = null
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ ...bitmap, close: closeSpy })),
  )
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return {
      canvas: this,
      drawImage(this: { canvas: HTMLCanvasElement }) {
        drawn = { width: this.canvas.width, height: this.canvas.height }
      },
    } as unknown as CanvasRenderingContext2D
  } as unknown as HTMLCanvasElement["getContext"])
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback: BlobCallback, type?: string) => {
    const behaviour = encoder[type ?? "image/png"]
    callback(behaviour ? new Blob([new Uint8Array(behaviour.size)], { type: behaviour.type }) : null)
  })
}

describe("prepareListingImageForUpload", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("downscales a large phone photo to the max dimension and re-encodes it as WebP", async () => {
    installBrowserImageApis({ width: 4032, height: 3024 }, { "image/webp": { type: "image/webp", size: 280_000 } })
    const original = makeFile(3 * MB)

    const result = await prepareListingImageForUpload(original)

    expect(result).not.toBe(original)
    expect(result.type).toBe("image/webp")
    expect(result.name).toBe("IMG_0001.webp")
    expect(result.size).toBe(280_000)
    expect(result.lastModified).toBe(original.lastModified)
    expect(drawn).toEqual({ width: LISTING_IMAGE_MAX_DIMENSION, height: 1200 })
    expect(closeSpy).toHaveBeenCalled()
  })

  it("keeps portrait orientation and does not upscale small dimensions", async () => {
    installBrowserImageApis({ width: 900, height: 1200 }, { "image/webp": { type: "image/webp", size: 120_000 } })

    const result = await prepareListingImageForUpload(makeFile(1 * MB))

    expect(drawn).toEqual({ width: 900, height: 1200 })
    expect(result.type).toBe("image/webp")
  })

  it("falls back to JPEG when the browser cannot encode WebP", async () => {
    installBrowserImageApis(
      { width: 4000, height: 3000 },
      { "image/webp": { type: "image/png", size: 5 * MB }, "image/jpeg": { type: "image/jpeg", size: 350_000 } },
    )

    const result = await prepareListingImageForUpload(makeFile(4 * MB))

    expect(result.type).toBe("image/jpeg")
    expect(result.name).toBe("IMG_0001.jpg")
  })

  it("keeps a PNG original instead of flattening transparency into JPEG", async () => {
    installBrowserImageApis(
      { width: 3000, height: 3000 },
      { "image/webp": { type: "image/png", size: 5 * MB }, "image/jpeg": { type: "image/jpeg", size: 200_000 } },
    )
    const original = makeFile(2 * MB, "image/png", "logo.png")

    expect(await prepareListingImageForUpload(original)).toBe(original)
  })

  it("returns the original when re-encoding would not make it smaller", async () => {
    installBrowserImageApis({ width: 2000, height: 1500 }, { "image/webp": { type: "image/webp", size: 900_000 } })
    const original = makeFile(800_000)

    expect(await prepareListingImageForUpload(original)).toBe(original)
  })

  it("skips files that are already small", async () => {
    installBrowserImageApis({ width: 4000, height: 3000 }, { "image/webp": { type: "image/webp", size: 10 } })
    const original = makeFile(100 * 1024)

    expect(await prepareListingImageForUpload(original)).toBe(original)
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled()
  })

  it("returns the original when the image cannot be decoded", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("decode failed") }))
    const original = makeFile(3 * MB)

    expect(await prepareListingImageForUpload(original)).toBe(original)
  })

  it("returns the original when createImageBitmap is unavailable", async () => {
    vi.stubGlobal("createImageBitmap", undefined)
    const original = makeFile(3 * MB)

    expect(await prepareListingImageForUpload(original)).toBe(original)
  })
})

describe("listing forms use the compressed file for preview and upload", () => {
  it.each(["CreateListingWizard.tsx", "CreateListingForm.tsx"])("%s", (fileName) => {
    const source = readFileSync(join(process.cwd(), "components", "dashboard", fileName), "utf8")
    expect(source).toContain('import { prepareListingImageForUpload } from "@/lib/listing-image-compression"')
    expect(source).toMatch(/const prepared = await prepareListingImageForUpload\(file\)/)
    expect(source).toMatch(/URL\.createObjectURL\(prepared\)/)
    expect(source).toMatch(/file: prepared/)
  })
})
