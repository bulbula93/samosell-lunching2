/**
 * Publishing worker tick. Bounded by design for Vercel CPU: ≤ maxJobs jobs and a wall-clock
 * deadline per invocation, no loops waiting for work, no polling when the queue is empty.
 */
import { createAdapter, PublishError, type MetaCredentials, type PublishAdapter } from "./adapters/meta"
import { evaluateSocialAction } from "./policy-gateway"
import { effectiveExecutionMode, type SocialRuntime } from "./runtime"
import type { ReviewResolution, SocialStore } from "./store"
import type { ExecutionMode, SocialPlatform } from "./types"

export type TickResult = { state: "stopped" | "idle" | "ran"; claimed: number; completed: number; failed: number; reconciled: number; results: Array<{ jobId: string; outcome: string }> }

/** Instagram jobs older than this that never went public are cancelled instead of posted late. */
export const STALE_REVIEW_MS = 48 * 3600_000
const RECONCILABLE = new Set(["lease_expired", "unknown_outcome", "container_already_published"])

/**
 * Resolve Instagram jobs stuck in needs_review by asking Meta for the container status.
 * Nothing on Instagram becomes public without media_publish on a recorded container, so:
 *   PUBLISHED → mark published (no resend) · FINISHED/IN_PROGRESS → resume the same container
 *   EXPIRED/ERROR or no container → it never went public → resend fresh, or cancel if stale.
 * Facebook jobs are never auto-resolved (no equivalent check): an admin decides.
 * If Meta cannot answer, the job stays in needs_review.
 */
export async function reconcileReviewJobs(opts: { store: SocialStore; factory: AdapterFactory; now: () => number; limit?: number }): Promise<Array<{ jobId: string; outcome: string }>> {
  const jobs = (await opts.store.listJobs(50))
    .filter(j => j.status === "needs_review" && j.platform === "instagram" && j.executionMode === "live" && RECONCILABLE.has(j.lastErrorCode ?? ""))
    .slice(0, opts.limit ?? 2)
  const out: Array<{ jobId: string; outcome: string }> = []
  for (const job of jobs) {
    let status = "NONE"
    // No recorded container is only conclusive for an expired lease (media_publish needs a recorded one).
    if (!job.externalContainerId && job.lastErrorCode !== "lease_expired") continue
    if (job.externalContainerId) {
      try {
        const adapter = opts.factory("instagram", "live")
        if (!adapter.containerStatus) continue
        status = await adapter.containerStatus(job.externalContainerId)
      } catch { out.push({ jobId: job.id, outcome: "reconcile_unavailable" }); continue }
    }
    const stale = opts.now() - Date.parse(job.scheduledAt) > STALE_REVIEW_MS
    let resolution: ReviewResolution | null
    if (status === "PUBLISHED") resolution = "published"
    else if (status === "FINISHED" || status === "IN_PROGRESS") resolution = stale ? "cancel" : "requeue_resume"
    else if (status === "EXPIRED" || status === "ERROR" || status === "NONE") resolution = stale ? "cancel" : "requeue_fresh"
    else resolution = null
    if (!resolution) { out.push({ jobId: job.id, outcome: `reconcile_unknown_${status.toLowerCase()}` }); continue }
    try {
      const next = await opts.store.resolveReviewJob(job.id, resolution, resolution === "published" ? `ig_container:${job.externalContainerId}` : null)
      await opts.store.appendAudit({ actorType: "system", actor: "publishing_worker", action: "publish_organic", decision: "success", reason: `review_auto_${resolution}`, resourceType: "social_publish_job", resourceId: job.id, details: { platform: "instagram", container_status: status, stale, next } })
      out.push({ jobId: job.id, outcome: `reconciled_${resolution}` })
    } catch { out.push({ jobId: job.id, outcome: "reconcile_failed" }) }
  }
  return out
}
export type AdapterFactory = (platform: SocialPlatform, mode: ExecutionMode) => PublishAdapter

export async function runPublishTick(opts: {
  store: SocialStore
  runtime: SocialRuntime
  credentials?: MetaCredentials | null
  adapterFactory?: AdapterFactory
  maxJobs?: number
  deadlineMs?: number
  now?: () => number
}): Promise<TickResult> {
  const { store, runtime } = opts
  const now = opts.now ?? Date.now
  const started = now()
  const deadline = opts.deadlineMs ?? 25_000
  const factory: AdapterFactory = opts.adapterFactory ?? ((p, m) => createAdapter(p, m, opts.credentials ?? null))
  const control = await store.getControl()
  if (!control || control.killSwitch) {
    await store.appendAudit({ actorType: "system", actor: "publishing_worker", action: "publish_organic", decision: "deny", reason: control ? "kill_switch_active" : "control_unavailable", resourceType: "worker", resourceId: null })
    return { state: "stopped", claimed: 0, completed: 0, failed: 0, reconciled: 0, results: [] }
  }
  // Only live Instagram jobs are reconciled, and only when live credentials are present.
  const reconciled = opts.credentials || opts.adapterFactory ? await reconcileReviewJobs({ store, factory, now }).catch(() => []) : []
  const claimed = await store.claimJobs(Math.min(opts.maxJobs ?? 3, 5), 120)
  const result: TickResult = { state: claimed.length || reconciled.length ? "ran" : "idle", claimed: claimed.length, completed: 0, failed: 0, reconciled: reconciled.filter(r => r.outcome.startsWith("reconciled_")).length, results: [...reconciled] }

  for (const { jobId, leaseToken } of claimed) {
    const job = await store.getJob(jobId)
    const post = job ? await store.getPost(job.postId) : null
    if (!job || !post) { await store.failJob(jobId, leaseToken, "job_or_post_missing", false); result.failed++; continue }
    // Never start a job that might not finish inside the function's maxDuration: an interrupted
    // Instagram publish leaves an expired lease (needs_review) instead of a clean retry.
    if (now() - started > deadline) {
      // Out of time: give the lease back as retryable without touching the provider.
      await store.failJob(jobId, leaseToken, "worker_deadline", true); result.results.push({ jobId, outcome: "deferred" }); continue
    }
    // Re-evaluate policy per job: the kill switch or platform flags may have changed after enqueue.
    const fresh = await store.getControl()
    const decision = evaluateSocialAction({ actor: "publishing", action: "publish_organic", runtime, control: fresh, platform: job.platform, post })
    const mode = fresh ? effectiveExecutionMode(runtime, fresh.executionMode) : "dry_run"
    if (decision.decision === "deny" || (job.executionMode === "live" && mode !== "live") || post.version !== job.postVersion) {
      const reason = decision.decision === "deny" ? decision.reason : post.version !== job.postVersion ? "post_version_changed" : "live_not_allowed"
      // Temporary stops (kill switch, live gate) return the job to the queue; structural changes do not.
      const retryable = reason === "kill_switch_active" || reason === "live_not_allowed" || reason === "control_unavailable"
      await store.failJob(jobId, leaseToken, reason, retryable)
      await store.appendAudit({ actorType: "system", actor: "publishing_worker", action: "publish_organic", decision: "deny", reason, resourceType: "social_publish_job", resourceId: jobId })
      result.failed++; result.results.push({ jobId, outcome: reason }); continue
    }
    if (job.externalPostId) {
      // Already published by an earlier attempt: never call the provider again.
      await store.completeJob(jobId, leaseToken, job.externalPostId)
      result.completed++; result.results.push({ jobId, outcome: "already_published" }); continue
    }
    try {
      const adapter = factory(job.platform, job.executionMode)
      if (adapter.mode !== job.executionMode) throw new PublishError("adapter_mode_mismatch", false)
      const published = await adapter.publish(
        { idempotencyKey: job.idempotencyKey, caption: post.caption, hashtags: post.hashtags, mediaUrls: post.mediaUrls, linkUrl: post.linkUrl, contentType: post.contentType, existingContainerId: job.externalContainerId },
        { recordContainer: async id => { if (!(await store.recordContainer(jobId, leaseToken, id))) throw new PublishError("lease_lost", false) } },
      )
      const ok = await store.completeJob(jobId, leaseToken, published.externalPostId)
      await store.appendAudit({ actorType: "system", actor: "publishing_worker", action: "publish_organic", decision: job.executionMode === "live" ? "success" : "dry_run", reason: ok ? "publish_completed" : "lease_lost_after_publish", resourceType: "social_publish_job", resourceId: jobId, details: { platform: job.platform, mode: job.executionMode } })
      if (ok) { result.completed++; result.results.push({ jobId, outcome: job.executionMode === "live" ? "published" : "dry_run_completed" }) }
      else { result.failed++; result.results.push({ jobId, outcome: "lease_lost_after_publish" }) }
    } catch (error) {
      const e = error instanceof PublishError ? error : new PublishError("publish_failed", false)
      const status = await store.failJob(jobId, leaseToken, e.code, e.retryable)
      await store.appendAudit({ actorType: "system", actor: "publishing_worker", action: "publish_organic", decision: "failure", reason: e.code, resourceType: "social_publish_job", resourceId: jobId, details: { platform: job.platform, next: status, meta_code: e.metaCode, meta_subcode: e.metaSubcode } })
      result.failed++; result.results.push({ jobId, outcome: status })
    }
  }
  return result
}
