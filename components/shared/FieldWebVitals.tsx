"use client"

import { classifyViewport, getDocumentMetricContext } from "@/lib/web-vitals-context"
import { allowsAnalytics } from "@/lib/browser-preferences"
import { useCallback } from "react"
import { useReportWebVitals } from "next/web-vitals"

type MetricName = "LCP" | "INP" | "CLS" | "FCP" | "TTFB"
type RouteGroup = "home" | "catalog" | "search" | "listing" | "other"
type DeviceClass = "phone" | "tablet" | "desktop"
type Orientation = "portrait" | "landscape"

const reported = new Set<string>()

function getViewportContext() {
  const viewportWidth = Math.max(1, Math.round(window.visualViewport?.width ?? window.innerWidth))
  const viewportHeight = Math.max(1, Math.round(window.visualViewport?.height ?? window.innerHeight))
  const deviceClass: DeviceClass = classifyViewport(viewportWidth)
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

export default function FieldWebVitals() {
  const reportMetric = useCallback<Parameters<typeof useReportWebVitals>[0]>((metric) => {
    if (navigator.webdriver || !allowsAnalytics()) return
    if (!["LCP", "INP", "CLS", "FCP", "TTFB"].includes(metric.name)) return

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    const { pathname, routeGroup } = getDocumentMetricContext(navigation?.name ?? "", window.location.href)
    const key = `${metric.name}:${metric.id}:${metric.value}`
    if (reported.has(key)) return
    if (reported.size >= 100) reported.clear()
    reported.add(key)

    if (!["home", "catalog", "search", "listing"].includes(routeGroup)) return

    const viewport = getViewportContext()

    sendMetric({
      metricName: metric.name as MetricName,
      metricValue: metric.value,
      metricRating: metric.rating,
      routeGroup: routeGroup as RouteGroup,
      pathname,
      ...viewport,
    })
  }, [])
  useReportWebVitals(reportMetric)

  return null
}
