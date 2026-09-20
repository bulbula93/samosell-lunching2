"use client"

import { useReportWebVitals } from "next/web-vitals"

type MetricName = "LCP" | "INP" | "CLS" | "FCP" | "TTFB"
type RouteGroup = "home" | "catalog" | "search" | "listing" | "other"

function classifyRoute(pathname: string, search: string): RouteGroup {
  if (pathname === "/") return "home"
  if (pathname.startsWith("/listing/")) return "listing"
  if (pathname === "/catalog") {
    const params = new URLSearchParams(search)
    const query = String(params.get("q") ?? "").trim()
    return query ? "search" : "catalog"
  }
  return "other"
}

function sendMetric(payload: {
  metricName: MetricName
  metricValue: number
  metricRating?: string
  routeGroup: RouteGroup
  pathname: string
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
  useReportWebVitals((metric) => {
    if (navigator.webdriver) return
    if (!["LCP", "INP", "CLS", "FCP", "TTFB"].includes(metric.name)) return

    const pathname = window.location.pathname || "/"
    const routeGroup = classifyRoute(pathname, window.location.search)

    if (!["home", "catalog", "search", "listing"].includes(routeGroup)) return

    sendMetric({
      metricName: metric.name as MetricName,
      metricValue: metric.value,
      metricRating: metric.rating,
      routeGroup,
      pathname,
    })
  })

  return null
}
