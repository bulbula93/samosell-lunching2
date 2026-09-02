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
}

export default function SmartImage({
  src,
  alt,
  wrapperClassName = "",
  className = "",
  fallbackLabel = ka.product.imageUnavailable,
  loading = "lazy",
  sizes = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw",
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const revealImmediately = loading === "eager"

  const safeSrc = useMemo(() => {
    return getSafeImageSource(src) ?? ""
  }, [src])

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
      <Image
        src={safeSrc}
        alt={alt}
        fill
        sizes={sizes}
        loading={loading}
        fetchPriority={revealImmediately ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition duration-300 ${loaded || revealImmediately ? "scale-100 opacity-100 blur-0" : "scale-[1.03] opacity-0 blur-sm"} ${className}`}
      />
    </div>
  )
}
