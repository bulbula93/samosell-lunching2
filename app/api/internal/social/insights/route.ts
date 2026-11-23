import { timingSafeEqual } from "node:crypto"
import { readMetaCredentials } from "@/lib/social/adapters/meta"
import { syncInsights } from "@/lib/social/insights"
import { currentSocialRuntime } from "@/lib/social/runtime"
import { createSocialStore } from "@/lib/social/supabase-store"

export const maxDuration = 60
export const dynamic = "force-dynamic"

/**
 * Daily Meta results sync, called once a day by pg_cron. Read-only towards Meta (GET only).
 * Same guard as the other social workers: SOCIAL_WORKER_ENABLED, an allowed backend and Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const runtime = currentSocialRuntime()
  const secret = process.env.CRON_SECRET
  const provided = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(secret ? `Bearer ${secret}` : "")
  if (!runtime.workerEnabled || !secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }
  const store = createSocialStore(runtime)
  if (!store) return Response.json({ error: runtime.backendReason }, { status: 503, headers: { "Cache-Control": "no-store" } })
  try {
    const credentials = runtime.executionModeCeiling === "live" ? readMetaCredentials() : null
    const r = await syncInsights({ store, runtime, credentials })
    return Response.json({ ok: r.state === "ran", posts: r.posts, updated: r.updated, failed: r.failed, error: r.firstError }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ ok: false, error: "social_insights_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
