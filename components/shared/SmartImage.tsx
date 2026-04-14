"use client"

import { useMemo, useState } from "react"

type SmartImageProps = {
  src?: string | null
  alt: string
  wrapperClassName?: string
  className?: string
  fallbackLabel?: string
  loading?: "eager" | "lazy"
}

export default function SmartImage({
  src,
  alt,
  wrapperClassName = "",
  className = "",
  fallbackLabel = "სურათი არ არის",
  loading = "lazy",
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const safeSrc = useMemo(() => {
    const value = String(src ?? "").trim()
    return value.length > 0 ? value : ""
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
        className={`absolute inset-0 bg-[linear-gradient(110deg,rgba(229,229,229,0.9),rgba(245,245,245,0.95),rgba(229,229,229,0.9))] bg-[length:200%_100%] transition-opacity duration-300 ${loaded ? "pointer-events-none opacity-0" : "animate-pulse opacity-100"}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={safeSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition duration-300 ${loaded ? "scale-100 opacity-100 blur-0" : "scale-[1.03] opacity-0 blur-sm"} ${className}`}
      />
    </div>
  )
}
