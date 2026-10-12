/**
 * Browser-side upload preparation. Product originals up to ~7 MB were found
 * in Storage; shrinking future photos reduces first-transform work for
 * Next/Image, upload bytes and storage costs.
 *
 * Never discard a usable original: browsers without canvas/WebP or files that
 * would grow stay unchanged. This function must only be called in the browser.
 */
export const LISTING_IMAGE_OPTIMIZE_THRESHOLD_BYTES = 1_250_000
export const LISTING_IMAGE_MAX_EDGE = 1920
export const LISTING_IMAGE_WEBP_QUALITY = 0.82

export async function optimizeListingUploadImage(file: File): Promise<File> {
  if (file.size <= LISTING_IMAGE_OPTIMIZE_THRESHOLD_BYTES ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined") return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
    if (!bitmap.width || !bitmap.height) return file
    const scale = Math.min(1, LISTING_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return file
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const result = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", LISTING_IMAGE_WEBP_QUALITY)
    })
    if (!result || result.type !== "image/webp" || result.size >= file.size * 0.95) {
      return file
    }
    const outputName = file.name.replace(/\.[^.]+$/, "") + ".webp"
    return new File([result], outputName, { type: "image/webp", lastModified: file.lastModified })
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}
