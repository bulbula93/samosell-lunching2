"use client"

import { useCallback } from "react"
import { allowsAnalytics } from "@/lib/browser-preferences"
import { useReportWebVitals } from "next/web-vitals"

type MetricName = "LCP" | "INP" | "CLS" | "FCP" | "TTFB"
type RouteGroup = "home" | "catalog" | "search" | "listing" | "other"
type DeviceClass = "phone" | "tablet" | "desktop"
type Orientation = "portrait" | "landscape"

function classifyRoute(pathname: string, search: string): RouteGroup {
  if (pathname === "/") return "home"
  if (pathname.startsWith("/listing/")) return "listing"
  if (pathname === "/catalog" || pathname.startsWith("/catalog/")) {
    const params = new URLSearchParams(search)
    const query = String(params.get("q") ?? "").trim()
    return query ? "search" : "catalog"
  }
  return "other"
}


function getViewportContext() {
  const viewportWidth = Math.max(1, Math.round(window.visualViewport?.width ?? window.innerWidth))
  const viewportHeight = Math.max(1, Math.round(window.visualViewport?.height ?? window.innerHeight))
  const shortestSide = Math.min(viewportWidth, viewportHeight)
  const deviceClass: DeviceClass =
    shortestSide <= 767 ? "phone" : shortestSide <= 1024 ? "tablet" : "desktop"
  const orientation: Orientation = viewportWidth > viewportHeight ? "landscape" : "portrait"

  return { deviceClass, viewportWidth, viewportHeight, orientation }
}

function sendMetric(payload: {
  metricName: MetricName
  metricValue: number
  metricRating?: string
  routeGroup: RouteGroup
  pathname: string
  deviceClass: DeviceClass
  viewportWidth: number
  viewportHeight: number
  orientation: Orientation
}) {
  const body = JSON.stringify(payload)

  if ("sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" })
    if (navigator.sendBeacon("/api/web-vitals", blob)) return
  }

  void fetch("/api/web-vitals", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    cache: "no-store",
  }).catch(() => undefined)
}

// Module lifetime survives consent component remounts; bounded per document.
const submittedMetrics = new Map<string, string>()

export default function FieldWebVitals() {
  const report = useCallback<Parameters<typeof useReportWebVitals>[0]>((metric) => {
    if (navigator.webdriver || !allowsAnalytics()) return
    if (!["LCP", "INP", "CLS", "FCP", "TTFB"].includes(metric.name)) return

    const pathname = window.location.pathname || "/"
    const routeGroup = classifyRoute(pathname, window.location.search)

    if (!["home", "catalog", "search", "listing"].includes(routeGroup)) return

    if (!Number.isFinite(metric.value) || metric.value < 0) return
    const key = `${metric.name}:${metric.id}`
    const signature = `${metric.value}:${metric.rating}`
    if (submittedMetrics.get(key) === signature) return
    submittedMetrics.set(key, signature)
    if (submittedMetrics.size > 1000) submittedMetrics.delete(submittedMetrics.keys().next().value!)

    const viewport = getViewportContext()

    sendMetric({
      metricName: metric.name as MetricName,
      metricValue: metric.value,
      metricRating: metric.rating,
      routeGroup,
      pathname,
      ...viewport,
    })
  }, [])
  useReportWebVitals(report)

  return null
}
