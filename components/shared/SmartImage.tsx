"use client"

import Image from "next/image"
import { useMemo, useRef, useState, type SyntheticEvent } from "react"
import { ka } from "@/lib/i18n/ka"
import { getSafeImageSource } from "@/lib/media"

type SmartImageFit = "cover" | "contain" | "auto"

type SmartImageProps = {
  src?: string | null
  alt: string
  wrapperClassName?: string
  className?: string
  fallbackLabel?: string
  loading?: "eager" | "lazy"
  sizes?: string
  /**
   * "cover"   fills the frame and crops overflow (default).
   * "contain" always shows the whole photo.
   * "auto"    covers when the photo's shape is close to the frame (typical phone
   *           portrait shots: no bands, only a few % trimmed) and switches to
   *           contain for clearly different shapes (landscape, square banners).
   * With `backdrop`, contain bands are filled by an opaque blurred copy of the
   * same image instead of a flat grey background.
   */
  fit?: SmartImageFit
  backdrop?: boolean
  /** Frame width / height. Measured from the wrapper when omitted. */
  frameAspect?: number
}

/** Max ratio between photo and frame aspect that is still cropped instead of letterboxed. */
export const AUTO_FIT_COVER_TOLERANCE = 1.2

export function shouldCoverForAspect(imageAspect: number, frameAspect: number, tolerance = AUTO_FIT_COVER_TOLERANCE) {
  if (!(imageAspect > 0) || !(frameAspect > 0)) return true
  const ratio = imageAspect / frameAspect
  return ratio <= tolerance && ratio >= 1 / tolerance
}

export default function SmartImage({
  src,
  alt,
  wrapperClassName = "",
  className = "",
  fallbackLabel = ka.product.imageUnavailable,
  loading = "lazy",
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw",
  fit = "cover",
  backdrop = false,
  frameAspect,
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [autoContain, setAutoContain] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const revealImmediately = loading === "eager"

  const rawSrc = useMemo(() => String(src ?? "").trim(), [src])
  const isLocalPreview = rawSrc.startsWith("blob:")
  const safeSrc = useMemo(() => {
    if (isLocalPreview) return rawSrc
    return getSafeImageSource(rawSrc) ?? ""
  }, [isLocalPreview, rawSrc])

  if (!safeSrc || failed) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-neutral-100 px-4 text-center text-xs text-neutral-500 ${wrapperClassName}`}>
        {fallbackLabel}
      </div>
    )
  }

  const contain = fit === "contain" || (fit === "auto" && autoContain)
  const showBackdrop = backdrop && contain

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    if (fit === "auto") {
      const image = event.currentTarget
      const wrapper = wrapperRef.current
      const measuredFrame = wrapper && wrapper.clientHeight > 0 ? wrapper.clientWidth / wrapper.clientHeight : 0
      const frame = frameAspect ?? measuredFrame
      const imageAspect = image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 0
      setAutoContain(!shouldCoverForAspect(imageAspect, frame))
    }
    setLoaded(true)
  }

  return (
    <div ref={wrapperRef} className={`relative overflow-hidden bg-neutral-200 ${wrapperClassName}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-[linear-gradient(110deg,rgba(229,229,229,0.9),rgba(245,245,245,0.95),rgba(229,229,229,0.9))] bg-[length:200%_100%] transition-opacity duration-300 ${loaded || revealImmediately ? "pointer-events-none opacity-0" : "animate-pulse opacity-100"}`}
      />
      {showBackdrop ? (
        // Same URL and sizes as the main image, so the browser reuses one download.
        <Image
          src={safeSrc}
          alt=""
          aria-hidden="true"
          fill
          unoptimized={isLocalPreview}
          sizes={sizes}
          loading={loading}
          className="pointer-events-none scale-150 object-cover blur-xl saturate-[1.1]"
        />
      ) : null}
      <Image
        src={safeSrc}
        alt={alt}
        fill
        unoptimized={isLocalPreview}
        sizes={sizes}
        loading={loading}
        fetchPriority={revealImmediately ? "high" : "auto"}
        onLoad={handleLoad}
        onError={() => setFailed(true)}
        data-fit={contain ? "contain" : "cover"}
        className={`h-full w-full ${contain ? "object-contain" : "object-cover"} transition duration-300 ${loaded || revealImmediately ? "scale-100 opacity-100 blur-0" : "scale-[1.03] opacity-0 blur-sm"} ${className}`}
      />
    </div>
  )
}
