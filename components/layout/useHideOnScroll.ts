"use client"

import { useEffect, useState, type RefObject } from "react"

/** Below this scroll position the bar always stays visible. */
export const HIDE_ON_SCROLL_MIN_Y = 120
/** Ignore tiny jitter (momentum scrolling, address-bar resize). */
export const HIDE_ON_SCROLL_DELTA = 8

/**
 * Phone-only "hide while reading, show when scrolling back up" behaviour for a bar.
 * Never hides while keyboard focus is inside the bar (search field, open menu).
 */
export function useHideOnScroll(ref: RefObject<HTMLElement | null>, enabled = true) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!enabled || typeof window.matchMedia !== "function") return
    const media = window.matchMedia("(max-width: 767px)")
    let lastY = window.scrollY
    let frame = 0

    const update = () => {
      frame = 0
      const y = window.scrollY
      const delta = y - lastY
      if (!media.matches || y < HIDE_ON_SCROLL_MIN_Y || ref.current?.contains(document.activeElement)) {
        setHidden(false)
        lastY = y
        return
      }
      if (Math.abs(delta) < HIDE_ON_SCROLL_DELTA) return
      setHidden(delta > 0)
      lastY = y
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    const onFocusIn = () => { if (ref.current?.contains(document.activeElement)) setHidden(false) }

    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("focusin", onFocusIn)
    media.addEventListener?.("change", update)
    return () => {
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("focusin", onFocusIn)
      media.removeEventListener?.("change", update)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [enabled, ref])

  return enabled && hidden
}
