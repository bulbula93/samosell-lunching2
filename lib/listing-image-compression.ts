// Client-side downscale + re-encode for listing photos before they are uploaded.
//
// Phone photos arrive at 2–7 MB and 3000–4000px. Catalog cards and the listing
// gallery never render wider than 1600px (see next.config.ts deviceSizes), so
// uploading the original only costs Storage, egress and mobile upload time.
//
// The function never throws and never makes an image worse: on any unsupported
// browser API, decode failure, or a result that is not smaller, it returns the
// original File unchanged so the existing upload path keeps working.

export const LISTING_IMAGE_MAX_DIMENSION = 1600
export const LISTING_IMAGE_QUALITY = 0.82
/** Files below this size are already web-sized; re-encoding them gains little. */
export const LISTING_IMAGE_MIN_BYTES_TO_COMPRESS = 300 * 1024

type PrepareOptions = {
  maxDimension?: number
  quality?: number
  minBytesToCompress?: number
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality)
    } catch {
      resolve(null)
    }
  })
}

function replaceExtension(name: string, extension: string) {
  const base = name.replace(/\.[^./\\]+$/, "") || "photo"
  return `${base}.${extension}`
}

export async function prepareListingImageForUpload(file: File, options: PrepareOptions = {}): Promise<File> {
  const maxDimension = options.maxDimension ?? LISTING_IMAGE_MAX_DIMENSION
  const quality = options.quality ?? LISTING_IMAGE_QUALITY
  const minBytes = options.minBytesToCompress ?? LISTING_IMAGE_MIN_BYTES_TO_COMPRESS

  if (file.size < minBytes) return file
  if (typeof window === "undefined" || typeof document === "undefined") return file
  if (typeof createImageBitmap !== "function") return file

  let bitmap: ImageBitmap | null = null
  try {
    // "from-image" applies EXIF orientation so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const longest = Math.max(bitmap.width, bitmap.height)
    if (!longest) return file

    const scale = Math.min(1, maxDimension / longest)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)

    let blob = await canvasToBlob(canvas, "image/webp", quality)
    if (!blob || blob.type !== "image/webp") {
      // Some browsers silently fall back to PNG for unsupported encoders.
      // JPEG has no alpha channel, so keep transparent PNG originals intact.
      blob = file.type === "image/png" ? null : await canvasToBlob(canvas, "image/jpeg", quality)
      if (blob && blob.type !== "image/jpeg") blob = null
    }

    canvas.width = 0
    canvas.height = 0

    if (!blob || blob.size === 0 || blob.size >= file.size) return file

    const extension = blob.type === "image/webp" ? "webp" : "jpg"
    return new File([blob], replaceExtension(file.name, extension), {
      type: blob.type,
      lastModified: file.lastModified,
    })
  } catch {
    return file
  } finally {
    bitmap?.close?.()
  }
}
