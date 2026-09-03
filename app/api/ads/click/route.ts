import { after } from "next/server"
import { NextResponse } from "next/server"
import {
  getAdRequestIdentity,
  getTrackableAd,
  getTrackableTarget,
  parseAdEventInput,
  recordResolvedAdEvent,
} from "@/lib/ad-tracking"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const input = parseAdEventInput({
    adId: url.searchParams.get("ad_id"),
    placementKey: url.searchParams.get("placement"),
    pagePath: url.searchParams.get("page"),
    eventType: "click",
  })

  if (!input) return NextResponse.redirect(new URL("/", request.url), 303)

  const ad = await getTrackableAd(input.adId, input.placementKey)
  const target = ad ? getTrackableTarget(ad) : null
  if (!ad || !target) return NextResponse.redirect(new URL("/", request.url), 303)

  const identity = getAdRequestIdentity(request.headers)
  after(() => recordResolvedAdEvent(ad, input, identity))

  const response = NextResponse.redirect(new URL(target, request.url), 303)
  response.headers.set("cache-control", "no-store")
  response.headers.set("x-robots-tag", "noindex, nofollow")
  return response
}
