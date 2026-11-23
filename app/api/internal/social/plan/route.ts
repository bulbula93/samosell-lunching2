import { timingSafeEqual } from "node:crypto"
import { PolicyDeniedError, runPlanningCycle } from "@/lib/social/orchestrator"
import { currentSocialRuntime } from "@/lib/social/runtime"
import { createSocialMediaPreparer, createSocialStoryPreparer } from "@/lib/social/supabase-media"
import { createSocialStore } from "@/lib/social/supabase-store"

export const maxDuration = 60
export const dynamic = "force-dynamic"

/**
 * Weekly planning endpoint, called once a week by pg_cron (Thursday) for the following week.
 * Same guard as the publish tick: SOCIAL_WORKER_ENABLED, a backend allowed by the runtime and a
 * Bearer CRON_SECRET. It only creates drafts — QA and admin approval still apply, the kill switch
 * stops it, and re-running it is idempotent (one post per plan slot).
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
    const r = await runPlanningCycle({ store, runtime, prepareMedia: createSocialMediaPreparer(runtime), prepareStory: createSocialStoryPreparer(runtime) }, { target: "next" })
    await store.appendAudit({ actorType: "system", actor: "scheduler", action: "plan_content", decision: "success", reason: "weekly_auto_plan", resourceType: "plan", resourceId: r.weekStart, details: { created: r.created, existing: r.existing, stories: r.storiesCreated, qa_failed: r.failedQa } })
    return Response.json({ ok: true, weekStart: r.weekStart, created: r.created, existing: r.existing, stories: r.storiesCreated }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    const reason = e instanceof PolicyDeniedError ? e.reason : "social_plan_failed"
    return Response.json({ ok: false, error: reason }, { status: e instanceof PolicyDeniedError ? 409 : 503, headers: { "Cache-Control": "no-store" } })
  }
}
