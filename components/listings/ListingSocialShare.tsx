"use client"

import { useState } from "react"
import { getSafeImageSource } from "@/lib/media"

type ShareStatus =
  | "idle"
  | "copied"
  | "shared"
  | "storyPreparing"
  | "storyReady"
  | "storyDownloaded"
  | "error"

type ListingSocialShareProps = {
  url: string
  title: string
  text: string
  imageUrl?: string | null
  priceText: string
  className?: string
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  maxLines: number,
) {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    current = word
    if (lines.length >= maxLines - 1) break
  }

  if (current && lines.length < maxLines) lines.push(current)
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let last = lines[maxLines - 1] ?? ""
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1)
    }
    lines[maxLines - 1] = `${last.trim()}…`
  }

  return lines
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (image.naturalWidth - sourceWidth) / 2
  const sourceY = (image.naturalHeight - sourceHeight) / 2

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  )
}

async function loadStoryImage(imageUrl?: string | null) {
  const safeSource = getSafeImageSource(imageUrl)
  if (!safeSource) return null

  try {
    const response = await fetch(safeSource, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
    })
    if (!response.ok) return null

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const image = new Image()
    image.decoding = "async"

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("image_load_failed"))
      image.src = objectUrl
    })

    return { image, objectUrl }
  } catch {
    return null
  }
}

async function createInstagramStoryFile({
  title,
  priceText,
  imageUrl,
  url,
}: {
  title: string
  priceText: string
  imageUrl?: string | null
  url: string
}) {
  const canvas = document.createElement("canvas")
  canvas.width = 1080
  canvas.height = 1920

  const context = canvas.getContext("2d")
  if (!context) throw new Error("canvas_unavailable")

  const gradient = context.createLinearGradient(0, 0, 1080, 1920)
  gradient.addColorStop(0, "#fff8f2")
  gradient.addColorStop(0.58, "#ffffff")
  gradient.addColorStop(1, "#eef8f5")
  context.fillStyle = gradient
  context.fillRect(0, 0, 1080, 1920)

  context.fillStyle = "#0d665d"
  context.font = "900 72px Arial, sans-serif"
  context.fillText("SAMOSELL", 90, 135)

  context.fillStyle = "#68736f"
  context.font = "600 32px Arial, sans-serif"
  context.fillText("იპოვე · გაყიდე · გაუზიარე", 92, 190)

  context.fillStyle = "#e9eeec"
  context.fillRect(90, 250, 900, 1060)

  const loadedImage = await loadStoryImage(imageUrl)
  if (loadedImage) {
    try {
      drawImageCover(context, loadedImage.image, 90, 250, 900, 1060)
    } finally {
      URL.revokeObjectURL(loadedImage.objectUrl)
    }
  } else {
    context.fillStyle = "#dfe7e4"
    context.font = "700 42px Arial, sans-serif"
    context.textAlign = "center"
    context.fillText("SamoSell", 540, 770)
    context.textAlign = "start"
  }

  context.fillStyle = "rgba(255,255,255,0.94)"
  context.fillRect(90, 1240, 900, 530)

  context.fillStyle = "#17211f"
  context.font = "900 58px Arial, sans-serif"
  const titleLines = wrapCanvasText(context, title, 780, 3)
  titleLines.forEach((line, index) => {
    context.fillText(line, 150, 1365 + index * 70)
  })

  context.fillStyle = "#0d665d"
  context.font = "900 70px Arial, sans-serif"
  context.fillText(priceText, 150, 1605)

  context.fillStyle = "#17211f"
  context.font = "700 34px Arial, sans-serif"
  context.fillText("ნახე ნივთი SamoSell-ზე", 150, 1685)

  context.fillStyle = "#68736f"
  context.font = "600 28px Arial, sans-serif"
  let shortUrl = "samosell.ge"
  try {
    const parsed = new URL(url)
    shortUrl = `${parsed.host}${parsed.pathname}`
  } catch {
    // Keep the safe fallback domain label.
  }
  const clippedUrl = shortUrl.length > 48 ? `${shortUrl.slice(0, 45)}…` : shortUrl
  context.fillText(clippedUrl, 150, 1735)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("story_blob_failed"))),
      "image/png",
      0.96,
    )
  })

  return new File([blob], "samosell-instagram-story.png", { type: "image/png" })
}

function triggerFileDownload(file: File) {
  const objectUrl = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

export default function ListingSocialShare({
  url,
  title,
  text,
  imageUrl,
  priceText,
  className = "",
}: ListingSocialShareProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ShareStatus>("idle")

  const encodedUrl = encodeURIComponent(url)
  const encodedText = encodeURIComponent(text)
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`

  function resetStatus() {
    window.setTimeout(() => setStatus("idle"), 2600)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setStatus("copied")
      resetStatus()
    } catch {
      setStatus("error")
      resetStatus()
    }
  }

  async function shareNative() {
    if (!navigator.share) {
      await copyLink()
      return
    }

    try {
      await navigator.share({ title, text, url })
      setStatus("shared")
      resetStatus()
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      await copyLink()
    }
  }

  async function shareInstagramStory() {
    if (status === "storyPreparing") return
    setStatus("storyPreparing")

    const clipboardPromise = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(url).then(() => true).catch(() => false)
      : Promise.resolve(false)

    try {
      const file = await createInstagramStoryFile({ title, priceText, imageUrl, url })
      const copied = await clipboardPromise
      const canShareFile =
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }))

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: `${title} — SamoSell`,
            text: copied
              ? "Instagram-ში აირჩიე Story. ნივთის ბმული უკვე დაკოპირებულია — ჩასვი Link sticker-ში."
              : "Instagram-ში აირჩიე Story.",
          })
          setStatus("storyReady")
          resetStatus()
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setStatus(copied ? "copied" : "idle")
            resetStatus()
            return
          }
        }
      }

      triggerFileDownload(file)
      setStatus("storyDownloaded")
      resetStatus()
    } catch {
      await clipboardPromise
      setStatus("error")
      resetStatus()
    }
  }

  const statusMessage =
    status === "copied"
      ? "ბმული დაკოპირდა"
      : status === "shared"
        ? "გაზიარებულია"
        : status === "storyPreparing"
          ? "Instagram Story-ის სურათი მზადდება…"
          : status === "storyReady"
            ? "სთორის სურათი მზადაა. Link sticker-ისთვის ბმული შეგიძლია ქვემოთ დააკოპირო."
            : status === "storyDownloaded"
              ? "სთორის სურათი ჩამოიტვირთა. Link sticker-ისთვის ბმული შეგიძლია ქვემოთ დააკოპირო."
              : status === "error"
                ? "გაზიარება ვერ შესრულდა"
                : ""

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="listing-social-share-panel"
        onClick={() => setOpen((value) => !value)}
        className="min-h-11 w-full rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand-soft/40"
      >
        გაზიარება
      </button>

      {open ? (
        <div
          id="listing-social-share-panel"
          className="mt-3 rounded-2xl border border-line bg-white p-3 shadow-[0_18px_50px_rgba(25,51,46,0.12)] sm:p-4"
        >
          <button
            type="button"
            onClick={shareInstagramStory}
            disabled={status === "storyPreparing"}
            className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-[#e6d4e8] bg-[linear-gradient(135deg,#fff4fa,#fff8ee)] px-4 py-3 text-left transition hover:border-[#cba7d0] disabled:cursor-wait disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f58529,#dd2a7b,#8134af)] text-lg font-black text-white"
            >
              ◎
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-text">Instagram Story</span>
              <span className="mt-0.5 block text-xs leading-5 text-text-soft">
                9:16 სთორის სურათი მზადდება; შემდეგ აირჩიე Instagram → Story. ბმულს Link sticker-ისთვის დაგიკოპირებთ.
              </span>
            </span>
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-3 text-sm font-bold text-text transition hover:bg-surface-alt"
            >
              Facebook
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-3 text-sm font-bold text-text transition hover:bg-surface-alt"
            >
              WhatsApp
            </a>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-3 text-sm font-bold text-text transition hover:bg-surface-alt"
            >
              Telegram
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-3 text-sm font-bold text-text transition hover:bg-surface-alt"
            >
              ბმულის კოპირება
            </button>
            <button
              type="button"
              onClick={shareNative}
              className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface-alt px-3 text-sm font-bold text-text transition hover:border-brand/40 sm:col-span-1"
            >
              სხვა აპში
            </button>
          </div>
        </div>
      ) : null}

      <span className="ui-sr-status" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </span>
    </div>
  )
}
