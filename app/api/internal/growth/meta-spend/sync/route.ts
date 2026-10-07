import { timingSafeEqual } from "node:crypto"
import { syncMetaSpend } from "@/lib/growth/meta-spend-server"
import { MetaSpendError } from "@/lib/growth/meta-spend-source"

export const maxDuration = 60

// Schedule-ready only: no cron is added or activated by this change.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get("authorization") ?? ""
  const expected = secret ? `Bearer ${secret}` : ""
  const providedBytes = Buffer.from(provided)
  const expectedBytes = Buffer.from(expected)
  if (process.env.META_ADS_SPEND_CRON_ENABLED !== "true" || !secret || providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return Response.json({ error: "unauthorized" }, { status: 401 })
  try {
    return Response.json({ ok: true, ...await syncMetaSpend() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof MetaSpendError ? error.code : "meta_sync_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
