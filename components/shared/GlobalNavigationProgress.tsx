"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const COMPLETE_HIDE_DELAY_MS = 180

export default function GlobalNavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const activeRef = useRef(false)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousRouteRef = useRef("")

  function clearTimers() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  function startProgress() {
    clearTimers()
    activeRef.current = true
    setActive(true)
    setProgress((current) => Math.max(current, 12))

    progressTimerRef.current = setInterval(() => {
      setProgress((current) => {
        if (current >= 88) return current
        const remaining = 88 - current
        return Math.min(88, current + Math.max(1.5, remaining * 0.12))
      })
    }, 220)
  }

  function completeProgress() {
    if (!activeRef.current) return

    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }

    setProgress(100)
    hideTimerRef.current = setTimeout(() => {
      activeRef.current = false
      setActive(false)
      setProgress(0)
    }, COMPLETE_HIDE_DELAY_MS)
  }

  useEffect(() => {
    const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`

    if (!previousRouteRef.current) {
      previousRouteRef.current = routeKey
      return
    }

    if (routeKey !== previousRouteRef.current) {
      previousRouteRef.current = routeKey
      completeProgress()
    }
  }, [pathname, searchParams])

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) return

      const anchor = target.closest<HTMLAnchorElement>("a[href]")
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return

      const targetUrl = new URL(anchor.href, window.location.href)
      if (targetUrl.origin !== window.location.origin) return

      const currentUrl = new URL(window.location.href)
      const sameDocument =
        targetUrl.pathname === currentUrl.pathname &&
        targetUrl.search === currentUrl.search

      if (sameDocument) return

      startProgress()
    }

    function handlePopState() {
      startProgress()
    }

    document.addEventListener("click", handleDocumentClick, true)
    window.addEventListener("popstate", handlePopState)

    return () => {
      document.removeEventListener("click", handleDocumentClick, true)
      window.removeEventListener("popstate", handlePopState)
      clearTimers()
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[160] h-[3px] transition-opacity duration-150 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full origin-left bg-[linear-gradient(90deg,#075a53_0%,#f7b26a_72%,#ff7a00_100%)] shadow-[0_1px_8px_rgba(247,178,106,0.45)] transition-[transform] duration-200 ease-out"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  )
}
