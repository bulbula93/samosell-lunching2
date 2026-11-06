import { timingSafeEqual } from "node:crypto"
import { readMetaCredentials } from "@/lib/social/adapters/meta"
import { currentSocialRuntime } from "@/lib/social/runtime"
import { createSocialStore } from "@/lib/social/supabase-store"
import { runPublishTick } from "@/lib/social/worker"

export const maxDuration = 30
export const dynamic = "force-dynamic"

/**
 * Publishing worker endpoint. Schedule-ready only: NO cron is added by this change.
 * Requires SOCIAL_WORKER_ENABLED=true, a backend allowed by the runtime and a Bearer CRON_SECRET.
 * Cost: one short invocation per schedule tick; an empty queue returns after 2 DB round-trips.
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
    const result = await runPublishTick({ store, runtime, credentials, maxJobs: 3, deadlineMs: 20_000 })
    return Response.json({ ok: true, state: result.state, claimed: result.claimed, completed: result.completed, failed: result.failed }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return Response.json({ ok: false, error: "social_tick_failed" }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
