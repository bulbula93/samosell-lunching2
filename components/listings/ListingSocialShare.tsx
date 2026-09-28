"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
      <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.45a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
      <path d="M13.7 22v-9h3l.45-3.5H13.7V7.27c0-1.01.28-1.7 1.73-1.7H17.3V2.44c-.32-.04-1.42-.14-2.7-.14-2.67 0-4.5 1.63-4.5 4.63V9.5H7.08V13h3.02v9h3.6Z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
      <path d="M12.04 2A9.82 9.82 0 0 0 3.6 16.82L2 22l5.31-1.56A9.88 9.88 0 1 0 12.04 2Zm0 17.9a8 8 0 0 1-4.08-1.12l-.29-.17-3.15.92.94-3.07-.19-.31a7.94 7.94 0 1 1 6.77 3.75Zm4.36-5.95c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.63-1.2-1.42-1.34-1.66-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.31-.74-1.79-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.51.1.46-.07 1.4-.57 1.6-1.13.2-.55.2-1.03.14-1.13-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  )
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
      <path d="M21.7 3.35 18.7 20c-.23 1.17-.84 1.46-1.7.91l-4.57-3.37-2.2 2.12c-.24.24-.45.45-.92.45l.33-4.66 8.48-7.66c.37-.33-.08-.52-.57-.19L7.07 14.2l-4.52-1.41c-.98-.31-1-1 .2-1.47L20.4 4.51c.82-.3 1.53.18 1.3 1.84Z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 1 0-7.07-7.07L11 4.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 1 0 7.07 7.07L13 19.07" />
    </svg>
  )
}

function ShareMoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="2">
      <circle cx="18" cy="5" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="19" r="2" />
      <path d="m8 11 8-5M8 13l8 5" />
    </svg>
  )
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

const itemClass =
  "group flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"

export default function ListingSocialShare({
  url,
  title,
  text,
  imageUrl,
  priceText,
  className = "",
}: ListingSocialShareProps) {
  const [status, setStatus] = useState<ShareStatus>("idle")
  const storyFileRef = useRef<{ key: string; file: File } | null>(null)
  const storyFilePromiseRef = useRef<{ key: string; promise: Promise<File> } | null>(null)
  const storyKey = `${url}|${title}|${priceText}|${imageUrl ?? ""}`

  const prepareStoryFile = useCallback(() => {
    if (storyFileRef.current?.key === storyKey) {
      return Promise.resolve(storyFileRef.current.file)
    }
    if (storyFilePromiseRef.current?.key === storyKey) {
      return storyFilePromiseRef.current.promise
    }

    const promise = createInstagramStoryFile({ title, priceText, imageUrl, url })
      .then((file) => {
        if (storyFilePromiseRef.current?.key === storyKey) {
          storyFileRef.current = { key: storyKey, file }
        }
        return file
      })
      .finally(() => {
        if (storyFilePromiseRef.current?.key === storyKey) {
          storyFilePromiseRef.current = null
        }
      })

    storyFilePromiseRef.current = { key: storyKey, promise }
    return promise
  }, [imageUrl, priceText, storyKey, title, url])

  useEffect(() => {
    storyFileRef.current = null
    storyFilePromiseRef.current = null

    const timer = window.setTimeout(() => {
      void prepareStoryFile().catch(() => undefined)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [prepareStoryFile])

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

    const clipboardPromise = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(url).then(() => true).catch(() => false)
      : Promise.resolve(false)

    const cachedFile = storyFileRef.current?.key === storyKey
      ? storyFileRef.current.file
      : null

    if (cachedFile && typeof navigator.share === "function") {
      const canShareFile =
        typeof navigator.canShare !== "function" || navigator.canShare({ files: [cachedFile] })

      if (canShareFile) {
        try {
          const sharePromise = navigator.share({
            files: [cachedFile],
            title: `${title} — SamoSell`,
            text: "Instagram-ში აირჩიე Story. Link sticker-ისთვის პროდუქტის ბმულიც დაკოპირებულია.",
          })
          await sharePromise
          await clipboardPromise
          setStatus("storyReady")
          resetStatus()
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setStatus("idle")
            return
          }
        }
      }
    }

    setStatus("storyPreparing")

    try {
      const file = cachedFile ?? await prepareStoryFile()
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
              ? "Instagram-ში აირჩიე Story. პროდუქტის ბმული უკვე დაკოპირებულია — ჩასვი Link sticker-ში."
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
            ? "სთორის სურათი მზადაა. Link sticker-ისთვის ბმული დაკოპირებულია."
            : status === "storyDownloaded"
              ? "სთორის სურათი ჩამოიტვირთა. Link sticker-ისთვის ბმული შეგიძლია დააკოპირო."
              : status === "error"
                ? "გაზიარება ვერ შესრულდა"
                : ""

  return (
    <section aria-label="გაზიარება" className={`rounded-2xl border border-line bg-white p-3 sm:p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-text">გააზიარე</h3>
        {statusMessage ? (
          <span className="text-xs font-semibold text-brand" role="status" aria-live="polite">
            {statusMessage}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-6 gap-1 sm:gap-2">
        <button
          type="button"
          onPointerEnter={() => void prepareStoryFile().catch(() => undefined)}
          onFocus={() => void prepareStoryFile().catch(() => undefined)}
          onTouchStart={() => void prepareStoryFile().catch(() => undefined)}
          onClick={shareInstagramStory}
          disabled={status === "storyPreparing"}
          className={itemClass}
          aria-label="Instagram Story-ზე გაზიარება"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f58529,#dd2a7b,#8134af)] text-white shadow-sm transition group-hover:scale-105">
            <InstagramIcon />
          </span>
          <span className="text-[10px] font-bold leading-4 text-text-soft sm:text-xs">Story</span>
        </button>

        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={itemClass}
          aria-label="Facebook-ზე გაზიარება"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-sm transition group-hover:scale-105">
            <FacebookIcon />
          </span>
          <span className="text-[10px] font-bold leading-4 text-text-soft sm:text-xs">Facebook</span>
        </a>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={itemClass}
          aria-label="WhatsApp-ში გაზიარება"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm transition group-hover:scale-105">
            <WhatsAppIcon />
          </span>
          <span className="text-[10px] font-bold leading-4 text-text-soft sm:text-xs">WhatsApp</span>
        </a>

        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={itemClass}
          aria-label="Telegram-ში გაზიარება"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#229ED9] text-white shadow-sm transition group-hover:scale-105">
            <TelegramIcon />
          </span>
          <span className="text-[10px] font-bold leading-4 text-text-soft sm:text-xs">Telegram</span>
        </a>

        <button
          type="button"
          onClick={copyLink}
          className={itemClass}
          aria-label="პროდუქტის ბმულის კოპირება"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-alt text-text shadow-sm transition group-hover:scale-105 group-hover:border-brand/30">
            <LinkIcon />
          </span>
          <span className="text-[10px] font-bold leading-4 text-text-soft sm:text-xs">ლინკი</span>
        </button>

        <button
          type="button"
          onClick={shareNative}
          className={itemClass}
          aria-label="სხვა აპში გაზიარება"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-alt text-text shadow-sm transition group-hover:scale-105 group-hover:border-brand/30">
            <ShareMoreIcon />
          </span>
          <span className="text-[10px] font-bold leading-4 text-text-soft sm:text-xs">სხვა</span>
        </button>
      </div>
    </section>
  )
}
