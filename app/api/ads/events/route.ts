import { after } from "next/server"
import {
  getAdRequestIdentity,
  parseAdEventInput,
  recordAdEvent,
} from "@/lib/ad-tracking"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const input = parseAdEventInput(payload)
  if (!input || input.eventType !== "impression") {
    return Response.json({ error: "invalid_ad_event" }, { status: 400 })
  }

  const identity = getAdRequestIdentity(request.headers)
  after(() => recordAdEvent(input, identity))
  return new Response(null, { status: 202, headers: { "cache-control": "no-store" } })
}
