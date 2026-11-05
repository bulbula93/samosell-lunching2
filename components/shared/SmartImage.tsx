"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { ka } from "@/lib/i18n/ka"
import { getSafeImageSource } from "@/lib/media"

type SmartImageProps = {
  src?: string | null
  alt: string
  wrapperClassName?: string
  className?: string
  fallbackLabel?: string
  loading?: "eager" | "lazy"
  sizes?: string
  /**
   * "cover" fills the frame and crops overflow (default).
   * "contain" shows the whole photo; with `backdrop` the empty bands are filled
   * by a blurred copy of the same image so grid cards keep a uniform shape.
   */
  fit?: "cover" | "contain"
  backdrop?: boolean
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
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
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

  return (
    <div className={`relative overflow-hidden bg-neutral-200 ${wrapperClassName}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-[linear-gradient(110deg,rgba(229,229,229,0.9),rgba(245,245,245,0.95),rgba(229,229,229,0.9))] bg-[length:200%_100%] transition-opacity duration-300 ${loaded || revealImmediately ? "pointer-events-none opacity-0" : "animate-pulse opacity-100"}`}
      />
      {fit === "contain" && backdrop ? (
        // Same URL and sizes as the main image, so the browser reuses one download.
        <Image
          src={safeSrc}
          alt=""
          aria-hidden="true"
          fill
          unoptimized={isLocalPreview}
          sizes={sizes}
          loading={loading}
          className="pointer-events-none scale-110 object-cover opacity-55 blur-2xl"
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
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} transition duration-300 ${loaded || revealImmediately ? "scale-100 opacity-100 blur-0" : "scale-[1.03] opacity-0 blur-sm"} ${className}`}
      />
    </div>
  )
}
