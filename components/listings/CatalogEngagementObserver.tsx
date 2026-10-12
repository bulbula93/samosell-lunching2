"use client"

import { useBrowserConsent } from "@/components/privacy/useBrowserConsent"
import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from "react"
import { allowsAnalytics } from "@/lib/browser-preferences"

type Engagement = { listingId: string; kind: "impression" | "click"; position: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Only catalog grid cards are observed. Impression means >=50% of the
// card occupied the viewport for 800ms; it is not a server-render impression.
export default function CatalogEngagementObserver({ children }: { children: ReactNode }) {
  const consent = useBrowserConsent()
  const root = useRef<HTMLDivElement>(null)
  const pageId = useRef<string>("")
  const queued = useRef<Engagement[]>([])
  const sent = useRef(new Set<string>())
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = null
    if (!allowsAnalytics() || process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") {
      queued.current = []
      return
    }
    if (!pageId.current || queued.current.length === 0) return
    const pending = queued.current.splice(0)
    for (let offset = 0; offset < pending.length; offset += 20) {
      const events = pending.slice(offset, offset + 20)
      void fetch("/api/catalog-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        keepalive: true,
        body: JSON.stringify({ pageId: pageId.current, events }),
      }).catch(() => undefined)
    }
  }, [])

  const queueEvent = useCallback((event: Engagement, immediate: boolean) => {
    if (!allowsAnalytics() || process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") return
    if (!UUID.test(event.listingId)) return
    const key = `${event.kind}:${event.listingId}`
    if (sent.current.has(key)) return
    sent.current.add(key)
    queued.current.push(event)
    if (immediate || queued.current.length >= 20) flush()
    else if (!flushTimer.current) flushTimer.current = setTimeout(flush, 400)
  }, [flush])

  useEffect(() => {
    if (consent?.analytics !== true || !root.current ||
      process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") return
    pageId.current = crypto.randomUUID()
    sent.current = new Set()
    const pending = new Map<Element, ReturnType<typeof setTimeout>>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement
        const timer = pending.get(element)
        if (timer) { clearTimeout(timer); pending.delete(element) }
        const id = element.dataset.catalogListingId
        const position = Number(element.dataset.catalogPosition)
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5 &&
          !document.hidden && id && Number.isInteger(position)) {
          const scheduled = setTimeout(() => {
            pending.delete(element)
            if (!document.hidden) queueEvent({ listingId: id, position, kind: "impression" }, false)
          }, 800)
          pending.set(element, scheduled)
        }
      }
    }, { threshold: [0, 0.5, 1] })
    root.current.querySelectorAll("[data-catalog-listing-id]").forEach(el => observer.observe(el))
    const onVisibility = () => {
      if (document.hidden) {
        for (const timer of pending.values()) clearTimeout(timer)
        pending.clear()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", onVisibility)
      for (const timer of pending.values()) clearTimeout(timer)
      pending.clear()
      flush()
    }
  }, [consent?.analytics, flush, queueEvent])

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (consent?.analytics !== true || !(event.target instanceof Element)) return
    // Favorites or other controls must not be confused with opening a listing.
    const link = event.target.closest("a[data-catalog-open]")
    const wrapper = link?.closest<HTMLElement>("[data-catalog-listing-id]")
    if (!wrapper) return
    const listingId = wrapper.dataset.catalogListingId ?? ""
    const position = Number(wrapper.dataset.catalogPosition)
    if (Number.isInteger(position)) {
      queueEvent({ listingId, position, kind: "click" }, true)
    }
  }

  return <div ref={root} onClickCapture={handleClick}>{children}</div>
}
