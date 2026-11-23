"use client"
/**
 * Instagram Story image (1080×1920) for a listing, drawn in the user's browser — no server CPU.
 * Brand: the header logo (/brand/samosell-header-logo.svg) on a white band, dark green body,
 * FiraGO text, orange price tag, empty space at the bottom for the Link sticker.
 * Used by the listing page share bar and the "share after publish" dialog.
 */
import { getSafeImageSource } from "@/lib/media"

export const STORY_SIZE = { width: 1080, height: 1920 } as const
const LOGO_SRC = "/brand/samosell-header-logo.svg"
const GREEN = "#073f3b"
const ORANGE = "#fd7b01"
const FONT = "FiraGO, 'Noto Sans Georgian', Arial, sans-serif"

export function wrapCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number) {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth) { current = candidate; continue }
    if (current) lines.push(current)
    current = word
    if (lines.length >= maxLines - 1) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let last = lines[maxLines - 1] ?? ""
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last.trim()}…`
  }
  return lines
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sw = width / scale
  const sh = height / scale
  context.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, width, height)
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + w, y, x + w, y + h, r)
  context.arcTo(x + w, y + h, x, y + h, r)
  context.arcTo(x, y + h, x, y, r)
  context.arcTo(x, y, x + w, y, r)
  context.closePath()
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = "async"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("image_load_failed"))
    image.src = src
  })
}

/** Listing photo via fetch → blob URL, so the canvas stays exportable (no CORS taint). */
async function loadListingPhoto(imageUrl?: string | null) {
  const safeSource = getSafeImageSource(imageUrl)
  if (!safeSource) return null
  try {
    const response = await fetch(safeSource, { mode: "cors", credentials: "omit", cache: "force-cache" })
    if (!response.ok) return null
    const objectUrl = URL.createObjectURL(await response.blob())
    try { return { image: await loadImageElement(objectUrl), objectUrl } }
    catch { URL.revokeObjectURL(objectUrl); return null }
  } catch {
    return null
  }
}

/** FiraGO is the site font; make sure canvas text uses it (falls back silently). */
async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return
  try { await Promise.all(["800 64px FiraGO", "600 32px FiraGO"].map(f => document.fonts.load(f, "ა"))) } catch { /* fallback font */ }
}

export async function createInstagramStoryFile({ title, priceText, imageUrl, subtitle }: {
  title: string
  priceText: string
  imageUrl?: string | null
  /** e.g. "ახალივით · თბილისი"; omitted when unknown. */
  subtitle?: string | null
}) {
  const canvas = document.createElement("canvas")
  canvas.width = STORY_SIZE.width
  canvas.height = STORY_SIZE.height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("canvas_unavailable")

  const [, logo, photo] = await Promise.all([
    ensureFonts(),
    loadImageElement(LOGO_SRC).catch(() => null),
    loadListingPhoto(imageUrl),
  ])

  // Body
  context.fillStyle = GREEN
  context.fillRect(0, 0, 1080, 1920)

  // White header band with the real logo (the logo's dark green needs a light background).
  context.fillStyle = "#ffffff"
  roundRect(context, 0, -60, 1080, 290, 60)
  context.fill()
  if (logo && logo.naturalWidth) {
    const h = 118
    const w = (logo.naturalWidth / logo.naturalHeight) * h
    context.drawImage(logo, 70, 56, w, h)
  } else {
    context.fillStyle = GREEN
    context.font = `800 84px ${FONT}`
    context.fillText("Samo$ell", 70, 150)
  }
  context.fillStyle = "#4d5956"
  context.font = `600 32px ${FONT}`
  context.textAlign = "right"
  context.fillText("იპოვე · გაყიდე", 1010, 128)
  context.textAlign = "start"

  // Photo
  const px = 70, py = 280, pw = 940, ph = 1000
  context.save()
  roundRect(context, px, py, pw, ph, 56)
  context.clip()
  context.fillStyle = "#dfe7e4"
  context.fillRect(px, py, pw, ph)
  if (photo) {
    try { drawImageCover(context, photo.image, px, py, pw, ph) } finally { URL.revokeObjectURL(photo.objectUrl) }
  } else {
    context.fillStyle = "#3d4a47"
    context.font = `700 44px ${FONT}`
    context.textAlign = "center"
    context.fillText("SamoSell", 540, py + ph / 2)
    context.textAlign = "start"
  }
  context.restore()

  if (subtitle) {
    context.font = `800 32px ${FONT}`
    const w = context.measureText(subtitle).width + 56
    context.fillStyle = "#ffffff"
    roundRect(context, px + 32, py + 32, w, 64, 32)
    context.fill()
    context.fillStyle = GREEN
    context.fillText(subtitle, px + 60, py + 75)
  }

  // Title
  context.fillStyle = "#ffffff"
  context.font = `800 60px ${FONT}`
  const lines = wrapCanvasText(context, title, 940, 2)
  lines.forEach((line, i) => context.fillText(line, 70, 1370 + i * 76))

  // Price tag + call to action
  const priceY = 1370 + lines.length * 76 + 10
  context.font = `800 80px ${FONT}`
  const priceW = context.measureText(priceText).width + 80
  context.fillStyle = ORANGE
  roundRect(context, 70, priceY, priceW, 116, 36)
  context.fill()
  context.fillStyle = "#1f1306"
  context.fillText(priceText, 110, priceY + 86)
  context.fillStyle = "#b9d6cf"
  context.font = `700 36px ${FONT}`
  context.fillText("ნახე და მომწერე SamoSell-ზე", 70 + priceW + 32, priceY + 72)

  // Bottom stays free for Instagram's Link sticker.
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => (result ? resolve(result) : reject(new Error("story_blob_failed"))), "image/png")
  })
  return new File([blob], "samosell-instagram-story.png", { type: "image/png" })
}

export function triggerFileDownload(file: File) {
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

/** True when this browser can hand an image file to the OS share sheet (phones). */
export function canShareFiles(file?: File) {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false
  if (typeof navigator.canShare !== "function") return false
  try { return navigator.canShare({ files: [file ?? new File([""], "x.png", { type: "image/png" })] }) } catch { return false }
}

/** Share-link builders. utm_medium=seller_share lets the admin results panel count these visits. */
export function withShareUtm(url: string, source: "instagram" | "facebook" | "copy", campaign = "post_publish") {
  try {
    const u = new URL(url)
    u.searchParams.set("utm_source", source)
    u.searchParams.set("utm_medium", "seller_share")
    u.searchParams.set("utm_campaign", campaign)
    return u.toString()
  } catch {
    return url
  }
}
export const facebookShareUrl = (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
