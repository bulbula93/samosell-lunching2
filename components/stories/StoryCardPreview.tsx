"use client"
/* eslint-disable @next/next/no-img-element -- Private, expiring media must bypass the image optimizer cache. */

import { useEffect, useState } from "react"
import type { StoryOwner } from "@/types/story"

export default function StoryCardPreview({ preview }: { preview: NonNullable<StoryOwner["preview"]> }) {
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    const remaining = Date.parse(preview.expiresAt) - Date.now()
    const timer = window.setTimeout(() => setUnavailable(true), Number.isFinite(remaining) ? Math.max(0, remaining) : 0)
    return () => window.clearTimeout(timer)
  }, [preview.expiresAt])
  if (unavailable) return null
  const src = `/api/stories/media/${preview.storyId}`
  const className = "absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-105"
  return preview.mediaType === "video"
    ? <video src={`${src}#t=0.1`} muted playsInline preload="metadata" aria-hidden="true" className={className} onError={() => setUnavailable(true)} />
    : <img src={src} alt="" loading="lazy" decoding="async" className={className} onError={() => setUnavailable(true)} />
}
