import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const metricNames = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"])
const ratings = new Set(["good", "needs-improvement", "poor"])
const routeGroups = new Set(["home", "catalog", "search", "listing"])
const deviceClasses = new Set(["phone", "tablet", "desktop"])
const orientations = new Set(["portrait", "landscape"])

function isKnownBot(userAgent: string) {
  return /bot|crawler|spider|headless|lighthouse|pagespeed|pingdom|uptime|monitor/i.test(userAgent)
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const requestOrigin = new URL(request.url).origin
  if (origin && origin !== requestOrigin) {
    return new NextResponse(null, { status: 403 })
  }

  if (isKnownBot(request.headers.get("user-agent") ?? "")) {
    return new NextResponse(null, { status: 204 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  const body = payload as Record<string, unknown>
  const metricName = String(body.metricName ?? "")
  const metricValue = Number(body.metricValue)
  const metricRating = body.metricRating == null ? null : String(body.metricRating)
  const routeGroup = String(body.routeGroup ?? "")
  const pathname = String(body.pathname ?? "")
  const deviceClass = body.deviceClass == null ? null : String(body.deviceClass)
  const viewportWidth = body.viewportWidth == null ? null : Number(body.viewportWidth)
  const viewportHeight = body.viewportHeight == null ? null : Number(body.viewportHeight)
  const orientation = body.orientation == null ? null : String(body.orientation)

  if (
    !metricNames.has(metricName) ||
    !Number.isFinite(metricValue) ||
    metricValue < 0 ||
    metricValue >= 3_600_000 ||
    (metricRating !== null && !ratings.has(metricRating)) ||
    !routeGroups.has(routeGroup) ||
    pathname.length < 1 ||
    pathname.length > 300 ||
    (deviceClass !== null && !deviceClasses.has(deviceClass)) ||
    (orientation !== null && !orientations.has(orientation)) ||
    (viewportWidth !== null && (!Number.isInteger(viewportWidth) || viewportWidth < 1 || viewportWidth > 10000)) ||
    (viewportHeight !== null && (!Number.isInteger(viewportHeight) || viewportHeight < 1 || viewportHeight > 10000))
  ) {
    return NextResponse.json({ error: "invalid_metric" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from("web_vitals_events").insert({
    metric_name: metricName,
    metric_value: metricValue,
    metric_rating: metricRating,
    route_group: routeGroup,
    pathname,
    device_class: deviceClass,
    viewport_width: viewportWidth,
    viewport_height: viewportHeight,
    orientation,
  })

  if (error) {
    console.error("web_vitals_insert_failed", error.message)
    return NextResponse.json({ error: "insert_failed" }, { status: 500 })
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  })
}
