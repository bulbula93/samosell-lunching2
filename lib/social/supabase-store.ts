import "server-only"
/**
 * Supabase implementation of SocialStore. Server-only, service-role client.
 * Construct it ONLY through createSocialStore(), which checks the runtime backend allowlist first.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import type { SocialRuntime } from "./runtime"
import { SocialStoreError, type ClaimedJob, type ContentPatch, type ControlPatch, type SocialStore } from "./store"
import type { CreativeDraft } from "./agents/creative"
import type {
  AdDraft, AuditEntry, CandidateListing, ExecutionMode, MetricRow, PublishJob, QualityReport,
  SocialApproval, SocialControl, SocialPost, StoredAuditEntry,
} from "./types"

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === "string" ? v : null)
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0))

/** Map Postgres RAISE codes to stable errors; never leak driver text. */
function fail(error: { message?: string } | null, fallback = "storage_unavailable"): never {
  const known = /^(kill_switch_active|live_mode_disabled|post_not_found|post_not_approved|quality_not_passed|approval_missing|no_enabled_platform|social_post_locked|stale_version|post_not_reviewable|approval_not_pending|decider_required|invalid_mode)$/
  const msg = error?.message?.trim() ?? ""
  throw new SocialStoreError(known.test(msg) ? msg : fallback)
}

function toControl(r: Row): SocialControl {
  return {
    killSwitch: r.kill_switch !== false, executionMode: r.execution_mode === "live" ? "live" : "dry_run",
    instagramEnabled: r.instagram_enabled === true, facebookEnabled: r.facebook_enabled === true, tiktokEnabled: false,
    organicAutoPublish: r.organic_auto_publish === true, storiesEnabled: r.stories_enabled === true, approvalMode: "paid", dailyAdsBudgetUsd: num(r.daily_ads_budget_usd),
    paidAdsCreateAllowed: false, paidAdsActivateAllowed: false, paidAdsSpendModifyAllowed: false, updatedAt: String(r.updated_at),
    // Raw DB values are re-checked by the Policy Gateway; any non-false paid flag fails closed there.
    ...(r.paid_ads_create_allowed || r.paid_ads_activate_allowed || r.paid_ads_spend_modify_allowed || r.tiktok_enabled ? { dailyAdsBudgetUsd: -1 } : {}),
  }
}
function toPost(r: Row): SocialPost {
  return {
    id: String(r.id), idempotencyKey: String(r.idempotency_key), status: r.status as SocialPost["status"], pillar: r.pillar as SocialPost["pillar"],
    contentType: r.content_type as SocialPost["contentType"], caption: String(r.caption), hashtags: (r.hashtags as string[]) ?? [],
    mediaUrls: (r.media_urls as string[]) ?? [], linkUrl: str(r.link_url), listingId: str(r.listing_id),
    platforms: (r.platforms as SocialPost["platforms"]) ?? [], scheduledFor: String(r.scheduled_for), version: num(r.version),
    qualityPassed: r.quality_passed === true,
    qualityReport: r.quality_report && typeof r.quality_report === "object" && "checkedAt" in (r.quality_report as Row) ? (r.quality_report as QualityReport) : null,
    createdByType: r.created_by_type === "human" ? "human" : "agent", createdBy: String(r.created_by), createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }
}
function toApproval(r: Row): SocialApproval {
  return { id: String(r.id), postId: String(r.post_id), postVersion: num(r.post_version), status: r.status as SocialApproval["status"], requestedAt: String(r.requested_at), expiresAt: String(r.expires_at), decidedBy: str(r.decided_by), decidedAt: str(r.decided_at) }
}
function toJob(r: Row): PublishJob {
  return {
    id: String(r.id), postId: String(r.post_id), postVersion: num(r.post_version), platform: r.platform as PublishJob["platform"],
    executionMode: r.execution_mode === "live" ? "live" : "dry_run", idempotencyKey: String(r.idempotency_key), status: r.status as PublishJob["status"],
    attempt: num(r.attempt), maxAttempts: num(r.max_attempts), leaseToken: null, leasedUntil: str(r.leased_until), scheduledAt: String(r.scheduled_at),
    externalContainerId: str(r.external_container_id), externalPostId: str(r.external_post_id), lastErrorCode: str(r.last_error_code),
  }
}
const POST_COLS = "id,idempotency_key,status,pillar,content_type,caption,hashtags,media_urls,link_url,listing_id,platforms,scheduled_for,version,quality_passed,quality_report,created_by_type,created_by,created_at,updated_at"
const LISTING_COLS = "id,slug,title,price,city,cover_image_url,sale_type,brands(name),categories(name)"
const JOB_COLS = "id,post_id,post_version,platform,execution_mode,idempotency_key,status,attempt,max_attempts,leased_until,scheduled_at,external_container_id,external_post_id,last_error_code"

export class SupabaseSocialStore implements SocialStore {
  readonly kind = "supabase" as const
  constructor(private readonly db: SupabaseClient) {}

  async getControl() {
    const { data, error } = await this.db.from("social_control").select("*").eq("singleton", true).maybeSingle()
    if (error || !data) return null
    return toControl(data)
  }
  async updateControl(patch: ControlPatch, actorUserId: string | null) {
    const row: Row = { updated_at: new Date().toISOString(), updated_by: actorUserId }
    if (patch.killSwitch !== undefined) row.kill_switch = patch.killSwitch
    if (patch.executionMode !== undefined) row.execution_mode = patch.executionMode
    if (patch.instagramEnabled !== undefined) row.instagram_enabled = patch.instagramEnabled
    if (patch.facebookEnabled !== undefined) row.facebook_enabled = patch.facebookEnabled
    if (patch.organicAutoPublish !== undefined) row.organic_auto_publish = patch.organicAutoPublish
    if (patch.storiesEnabled !== undefined) row.stories_enabled = patch.storiesEnabled
    const { data, error } = await this.db.from("social_control").update(row).eq("singleton", true).select("*").single()
    if (error || !data) fail(error)
    return toControl(data)
  }
  async appendAudit(entry: AuditEntry) {
    const { error } = await this.db.from("social_audit_log").insert({
      actor_type: entry.actorType, actor: entry.actor.slice(0, 80), action: entry.action, decision: entry.decision,
      reason: entry.reason, resource_type: entry.resourceType, resource_id: entry.resourceId, details: entry.details ?? {},
    })
    if (error) fail(error, "audit_unavailable")
  }
  async listAudit(limit: number): Promise<StoredAuditEntry[]> {
    const { data, error } = await this.db.from("social_audit_log").select("id,occurred_at,actor_type,actor,action,decision,reason,resource_type,resource_id,details").order("id", { ascending: false }).limit(limit)
    if (error) fail(error)
    return (data ?? []).map(r => ({ id: num(r.id), occurredAt: String(r.occurred_at), actorType: r.actor_type, actor: r.actor, action: r.action, decision: r.decision, reason: r.reason, resourceType: r.resource_type, resourceId: r.resource_id, details: r.details }))
  }
  async insertDraft(draft: CreativeDraft, createdBy: { type: "agent" | "human"; id: string }) {
    const { data, error } = await this.db.from("social_posts").upsert({
      idempotency_key: draft.idempotencyKey, pillar: draft.pillar, content_type: draft.contentType, caption: draft.caption,
      hashtags: draft.hashtags, media_urls: draft.mediaUrls, link_url: draft.linkUrl, listing_id: draft.listingId,
      platforms: draft.platforms, scheduled_for: draft.scheduledFor, created_by_type: createdBy.type, created_by: createdBy.id,
    }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select(POST_COLS)
    if (error) fail(error)
    if (data && data.length > 0) return { post: toPost(data[0]), created: true }
    const existing = await this.db.from("social_posts").select(POST_COLS).eq("idempotency_key", draft.idempotencyKey).single()
    if (existing.error || !existing.data) fail(existing.error)
    return { post: toPost(existing.data), created: false }
  }
  async getPost(id: string) {
    const { data, error } = await this.db.from("social_posts").select(POST_COLS).eq("id", id).maybeSingle()
    if (error) fail(error)
    return data ? toPost(data) : null
  }
  async getPostByKey(key: string) {
    const { data, error } = await this.db.from("social_posts").select(POST_COLS).eq("idempotency_key", key).maybeSingle()
    if (error) fail(error)
    return data ? toPost(data) : null
  }
  async listPosts(fromIso: string, toIso: string, limit: number) {
    const { data, error } = await this.db.from("social_posts").select(POST_COLS).gte("scheduled_for", fromIso).lt("scheduled_for", toIso).order("scheduled_for").limit(limit)
    if (error) fail(error)
    return (data ?? []).map(toPost)
  }
  async updatePostContent(id: string, patch: ContentPatch) {
    const row: Row = {}
    if (patch.caption !== undefined) row.caption = patch.caption
    if (patch.hashtags !== undefined) row.hashtags = patch.hashtags
    if (patch.mediaUrls !== undefined) row.media_urls = patch.mediaUrls
    if (patch.linkUrl !== undefined) row.link_url = patch.linkUrl
    if (patch.platforms !== undefined) row.platforms = patch.platforms
    if (patch.scheduledFor !== undefined) row.scheduled_for = patch.scheduledFor
    const { data, error } = await this.db.from("social_posts").update(row).eq("id", id).select(POST_COLS).single()
    if (error || !data) fail(error, "post_not_found")
    return toPost(data)
  }
  async setQuality(id: string, version: number, report: QualityReport) {
    const { data, error } = await this.db.from("social_posts")
      .update({ quality_passed: report.passed, quality_report: report, status: report.passed ? "ready_for_review" : "qa_failed" })
      .eq("id", id).eq("version", version).in("status", ["draft", "qa_failed", "ready_for_review"]).select(POST_COLS)
    if (error) fail(error)
    if (!data || data.length !== 1) throw new SocialStoreError("stale_version")
    return toPost(data[0])
  }
  async requestApproval(postId: string, version: number) {
    const { error } = await this.db.from("social_approvals").upsert({ post_id: postId, post_version: version, action: "publish_organic" }, { onConflict: "post_id,post_version,action", ignoreDuplicates: true })
    if (error) fail(error)
    const { data, error: readError } = await this.db.from("social_approvals").select("*").eq("post_id", postId).eq("post_version", version).eq("action", "publish_organic").single()
    if (readError || !data) fail(readError)
    return toApproval(data)
  }
  async listApprovals(postId: string) {
    const { data, error } = await this.db.from("social_approvals").select("*").eq("post_id", postId).order("requested_at", { ascending: false }).limit(20)
    if (error) fail(error)
    return (data ?? []).map(toApproval)
  }
  async decideApproval(postId: string, version: number, approve: boolean, userId: string) {
    const { error } = await this.db.rpc("social_decide_approval", { p_post_id: postId, p_version: version, p_approve: approve, p_user: userId })
    if (error) fail(error)
    const post = await this.getPost(postId)
    if (!post) throw new SocialStoreError("post_not_found")
    return post
  }
  async enqueuePublish(postId: string, mode: ExecutionMode) {
    const { data, error } = await this.db.rpc("social_enqueue_publish", { p_post_id: postId, p_mode: mode })
    if (error) fail(error)
    return num(data)
  }
  async claimJobs(limit: number, leaseSeconds: number): Promise<ClaimedJob[]> {
    const { data, error } = await this.db.rpc("social_claim_publish_jobs", { p_limit: limit, p_lease_seconds: leaseSeconds })
    if (error) fail(error)
    return ((data ?? []) as Row[]).map(r => ({ jobId: String(r.job_id), leaseToken: String(r.lease_token) }))
  }
  async getJob(id: string) {
    const { data, error } = await this.db.from("social_publish_jobs").select(JOB_COLS).eq("id", id).maybeSingle()
    if (error) fail(error)
    return data ? toJob(data) : null
  }
  async listJobs(limit: number) {
    const { data, error } = await this.db.from("social_publish_jobs").select(JOB_COLS).order("created_at", { ascending: false }).limit(limit)
    if (error) fail(error)
    return (data ?? []).map(toJob)
  }
  async recordContainer(jobId: string, token: string, containerId: string) {
    const { data, error } = await this.db.rpc("social_record_container", { p_job_id: jobId, p_token: token, p_container_id: containerId })
    if (error) fail(error)
    return data === true
  }
  async completeJob(jobId: string, token: string, externalPostId: string) {
    const { data, error } = await this.db.rpc("social_complete_publish_job", { p_job_id: jobId, p_token: token, p_external_post_id: externalPostId })
    if (error) fail(error)
    return data === true
  }
  async failJob(jobId: string, token: string, errorCode: string, retryable: boolean) {
    const { data, error } = await this.db.rpc("social_fail_publish_job", { p_job_id: jobId, p_token: token, p_error: errorCode, p_retryable: retryable })
    if (error) fail(error)
    return String(data)
  }
  async listMetrics(sinceDate: string): Promise<MetricRow[]> {
    const { data, error } = await this.db.from("social_metrics_daily").select("*").gte("metric_date", sinceDate).limit(500)
    if (error) fail(error)
    return (data ?? []).map(r => ({ postId: r.post_id, platform: r.platform, metricDate: r.metric_date, impressions: r.impressions, reach: r.reach, likes: r.likes, comments: r.comments, shares: r.shares, saves: r.saves, linkClicks: r.link_clicks }))
  }
  async insertAdDraft(draft: Omit<AdDraft, "id">): Promise<AdDraft> {
    const { data, error } = await this.db.from("social_ad_drafts").upsert({
      idempotency_key: draft.idempotencyKey, title: draft.title, objective: draft.objective, audience_notes: draft.audienceNotes,
      creative_post_id: draft.creativePostId, daily_budget_usd: 0, status: "draft",
    }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id")
    if (error) fail(error)
    return { ...draft, id: String(data?.[0]?.id ?? draft.idempotencyKey) }
  }
  async listAdDrafts(limit: number): Promise<AdDraft[]> {
    const { data, error } = await this.db.from("social_ad_drafts").select("*").order("created_at", { ascending: false }).limit(limit)
    if (error) fail(error)
    return (data ?? []).map(r => ({ id: r.id, idempotencyKey: r.idempotency_key, title: r.title, objective: r.objective, audienceNotes: r.audience_notes, creativePostId: r.creative_post_id, dailyBudgetUsd: 0, status: r.status }))
  }
  private mapListing(r: Row): CandidateListing {
    const rel = (v: unknown) => (Array.isArray(v) ? str((v[0] as Row | undefined)?.name) : v && typeof v === "object" ? str((v as Row).name) : null)
    return { id: String(r.id), slug: String(r.slug), title: String(r.title), brand: rel(r.brands), category: rel(r.categories), priceGel: r.price === null ? null : num(r.price), city: str(r.city), imageUrl: str(r.cover_image_url), isGift: r.sale_type === "gift" }
  }
  async listCandidateListings(limit: number): Promise<CandidateListing[]> {
    // Public listing fields only — no seller identity, phone or description text.
    const { data, error } = await this.db.from("listings")
      .select(LISTING_COLS)
      .eq("status", "active").not("cover_image_url", "is", null)
      .order("published_at", { ascending: false }).limit(Math.min(limit, 60))
    if (error) fail(error)
    return (data ?? []).map((r: Row) => this.mapListing(r))
  }
  async getCandidateListing(id: string): Promise<CandidateListing | null> {
    const { data, error } = await this.db.from("listings").select(LISTING_COLS).eq("id", id).eq("status", "active").maybeSingle()
    if (error) fail(error)
    return data ? this.mapListing(data as Row) : null
  }

}

/** Fail-closed factory: returns null whenever the runtime does not allow a backend. */
export function createSocialStore(runtime: SocialRuntime): SocialStore | null {
  if (!runtime.backendAllowed) return null
  return new SupabaseSocialStore(createAdminClient())
}
