import { readFileSync } from "node:fs"
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { optimizeListingUploadImage,LISTING_IMAGE_MAX_EDGE,LISTING_IMAGE_OPTIMIZE_THRESHOLD_BYTES } from "@/lib/listing-image-optimization"

afterEach(()=>vi.unstubAllGlobals())

function fakeFile(size:number, name="wardrobe.jpg") {
  return new File([new Uint8Array(size)],name,{type:"image/jpeg",lastModified:42})
}

describe("Lossy listing image preprocessing for future uploads",()=>{
  it("preserves small files without invoking bitmap decoding",async()=>{
    const input=fakeFile(300_000)
    const dec=vi.fn()
    vi.stubGlobal("createImageBitmap",dec)
    expect(await optimizeListingUploadImage(input)).toBe(input)
    expect(dec).not.toHaveBeenCalled()
  })
  it("resizes oversized images before uploading and produces a smaller webp",async()=>{
    const image=fakeFile(LISTING_IMAGE_OPTIMIZE_THRESHOLD_BYTES+1_000_000)
    const closed=vi.fn()
    vi.stubGlobal("createImageBitmap",vi.fn().mockResolvedValue({width:4032,height:3024,close:closed}))
    const ctx={drawImage:vi.fn(),imageSmoothingEnabled:false,imageSmoothingQuality:"low"}
    const getContext=vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    const blob=vi.spyOn(HTMLCanvasElement.prototype,"toBlob").mockImplementation((cb)=>cb(new Blob([new Uint8Array(250_000)],{type:"image/webp"})))
    try {
      const optimized=await optimizeListingUploadImage(image)
      expect(optimized).not.toBe(image)
      expect(optimized.name).toBe("wardrobe.webp")
      expect(optimized.type).toBe("image/webp")
      expect(optimized.size).toBe(250_000)
      expect(optimized.lastModified).toBe(42)
      expect(ctx.drawImage).toHaveBeenCalledOnce()
      expect(getContext.mock.instances[0].width).toBeLessThanOrEqual(LISTING_IMAGE_MAX_EDGE)
      expect(closed).toHaveBeenCalledOnce()
    } finally {getContext.mockRestore();blob.mockRestore()}
  })
  it("does not discard the original if the browser cannot process or reduce it",async()=>{
    const image=fakeFile(2_000_000)
    vi.stubGlobal("createImageBitmap",vi.fn().mockRejectedValue(Error("codec unavailable")))
    expect(await optimizeListingUploadImage(image)).toBe(image)
  })
  it("is used by both seller listing entry points, before creating the draft preview",()=>{
    // Ensures the signed-upload plan and the original preview are based on the
    // same smaller File object rather than uploading an oversized original.
    for(const path of ["components/dashboard/CreateListingWizard.tsx","components/dashboard/CreateListingForm.tsx"]){
      const source=readFileSync(path,"utf8")
      expect(source).toContain("await optimizeListingUploadImage(file)")
      expect(source).toContain("validateImageFile(preparedFile)")
      expect(source).toContain("URL.createObjectURL(preparedFile)")
    }
  })
})
