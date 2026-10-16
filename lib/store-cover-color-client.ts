import { getSafeImageSource } from "@/lib/media"
import { dominantCoverColor, type CoverRgb } from "@/lib/store-cover-theme"

const colors = new Map<string, Promise<CoverRgb | null>>()

export function readStoreCoverColor(source: string): Promise<CoverRgb | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  const safe = source.startsWith("blob:") ? source : getSafeImageSource(source)
  if (!safe) return Promise.resolve(null)
  const cached = colors.get(safe)
  if (cached) return cached

  // Public storage covers use a small cached same-origin Next/Image variant;
  // do not download a second full-size original or require cross-origin canvas.
  const sampleUrl = safe.startsWith("https:")
    ? `/_next/image?url=${encodeURIComponent(safe)}&w=256&q=75`
    : safe
  const result = new Promise<CoverRgb | null>(resolve => {
    const image = new Image()
    let finished = false
    const finish = (color: CoverRgb | null) => {
      if (finished) return
      finished = true
      window.clearTimeout(timeout)
      image.onload = null
      image.onerror = null
      image.removeAttribute("src")
      resolve(color)
    }
    const timeout = window.setTimeout(() => finish(null), 8000)
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) return finish(null)
        const scale = 32 / Math.max(image.naturalWidth, image.naturalHeight)
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext("2d", { willReadFrequently: true })
        if (!context) return finish(null)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        finish(dominantCoverColor(context.getImageData(0, 0, canvas.width, canvas.height).data))
      } catch {
        finish(null)
      }
    }
    image.onerror = () => finish(null)
    image.src = sampleUrl
  }).catch(() => null)
  colors.set(safe, result)
  if (colors.size > 32) colors.delete(colors.keys().next().value!)
  void result.then(color => {
    if (!color && colors.get(safe) === result) colors.delete(safe)
  })
  return result
}
