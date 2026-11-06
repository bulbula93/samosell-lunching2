/**
 * Storage port for the Social Media Agent OS.
 * MemorySocialStore mirrors the SQL semantics in supabase/qa/social_media_agent_os_v1.sql so the
 * orchestrator/worker can be tested without a database and the Preview can run a no-persistence
 * simulation. The SQL file is the source of truth and has its own database tests.
 */
import type {
  AdDraft, AuditEntry, CandidateListing, ExecutionMode, JobStatus, MetricRow, PublishJob,
  QualityReport, SocialApproval, SocialControl, SocialPlatform, SocialPost, StoredAuditEntry,
} from "./types"
import type { CreativeDraft } from "./agents/creative"

export class SocialStoreError extends Error {
  constructor(public readonly code: string) { super(code) }
}

export type ControlPatch = Partial<Pick<SocialControl, "killSwitch" | "executionMode" | "instagramEnabled" | "facebookEnabled" | "organicAutoPublish">>
export type ContentPatch = Partial<Pick<SocialPost, "caption" | "hashtags" | "mediaUrls" | "linkUrl" | "platforms" | "scheduledFor">>
export type ClaimedJob = { jobId: string; leaseToken: string }

export interface SocialStore {
  readonly kind: "memory" | "supabase"
  getControl(): Promise<SocialControl | null>
  updateControl(patch: ControlPatch, actorUserId: string | null): Promise<SocialControl>
  appendAudit(entry: AuditEntry): Promise<void>
  listAudit(limit: number): Promise<StoredAuditEntry[]>
  insertDraft(draft: CreativeDraft, createdBy: { type: "agent" | "human"; id: string }): Promise<{ post: SocialPost; created: boolean }>
  getPost(id: string): Promise<SocialPost | null>
  listPosts(fromIso: string, toIso: string, limit: number): Promise<SocialPost[]>
  updatePostContent(id: string, patch: ContentPatch): Promise<SocialPost>
  setQuality(id: string, version: number, report: QualityReport): Promise<SocialPost>
  requestApproval(postId: string, version: number): Promise<SocialApproval>
  listApprovals(postId: string): Promise<SocialApproval[]>
  decideApproval(postId: string, version: number, approve: boolean, userId: string): Promise<SocialPost>
  enqueuePublish(postId: string, mode: ExecutionMode): Promise<number>
  claimJobs(limit: number, leaseSeconds: number): Promise<ClaimedJob[]>
  getJob(id: string): Promise<PublishJob | null>
  listJobs(limit: number): Promise<PublishJob[]>
  recordContainer(jobId: string, token: string, containerId: string): Promise<boolean>
  completeJob(jobId: string, token: string, externalPostId: string): Promise<boolean>
  failJob(jobId: string, token: string, errorCode: string, retryable: boolean): Promise<string>
  listMetrics(sinceDate: string): Promise<MetricRow[]>
  insertAdDraft(draft: Omit<AdDraft, "id">): Promise<AdDraft>
  listAdDrafts(limit: number): Promise<AdDraft[]>
  listCandidateListings(limit: number): Promise<CandidateListing[]>
}

export function defaultControl(nowIso: string): SocialControl {
  return {
    killSwitch: true, executionMode: "dry_run", instagramEnabled: true, facebookEnabled: true, tiktokEnabled: false,
    organicAutoPublish: false, approvalMode: "paid", dailyAdsBudgetUsd: 0,
    paidAdsCreateAllowed: false, paidAdsActivateAllowed: false, paidAdsSpendModifyAllowed: false, updatedAt: nowIso,
  }
}

const CONTENT_KEYS = ["caption", "hashtags", "mediaUrls", "linkUrl", "platforms"] as const
const LOCKED: SocialPost["status"][] = ["scheduled", "publishing", "published", "partially_published"]

export class MemorySocialStore implements SocialStore {
  readonly kind = "memory" as const
  control: SocialControl
  posts = new Map<string, SocialPost>()
  approvals: SocialApproval[] = []
  jobs = new Map<string, PublishJob>()
  audit: StoredAuditEntry[] = []
  metrics: MetricRow[] = []
  adDrafts: AdDraft[] = []
  listings: CandidateListing[] = []
  private seq = 0

  constructor(private readonly clock: () => Date = () => new Date(), control?: Partial<SocialControl>) {
    this.control = { ...defaultControl(clock().toISOString()), ...control } as SocialControl
  }
  private now() { return this.clock().toISOString() }
  private id(prefix: string) { this.seq += 1; return `${prefix}-${String(this.seq).padStart(8, "0")}-0000-4000-8000-000000000000`.slice(0, 36) }

  async getControl() { return { ...this.control } }
  async updateControl(patch: ControlPatch) {
    this.control = { ...this.control, ...patch, updatedAt: this.now() }
    return { ...this.control }
  }
  async appendAudit(entry: AuditEntry) { this.audit.push({ ...entry, id: this.audit.length + 1, occurredAt: this.now() }) }
  async listAudit(limit: number) { return [...this.audit].reverse().slice(0, limit) }

  async insertDraft(draft: CreativeDraft, createdBy: { type: "agent" | "human"; id: string }) {
    const existing = [...this.posts.values()].find(p => p.idempotencyKey === draft.idempotencyKey)
    if (existing) return { post: { ...existing }, created: false }
    const now = this.now()
    const post: SocialPost = {
      id: this.id("post"), idempotencyKey: draft.idempotencyKey, status: "draft", pillar: draft.pillar, contentType: draft.contentType,
      caption: draft.caption, hashtags: [...draft.hashtags], mediaUrls: [...draft.mediaUrls], linkUrl: draft.linkUrl,
      listingId: draft.listingId, platforms: [...draft.platforms], scheduledFor: draft.scheduledFor, version: 1,
      qualityPassed: false, qualityReport: null, createdByType: createdBy.type, createdBy: createdBy.id, createdAt: now, updatedAt: now,
    }
    this.posts.set(post.id, post)
    return { post: { ...post }, created: true }
  }
  async getPost(id: string) { const p = this.posts.get(id); return p ? { ...p } : null }
  async listPosts(fromIso: string, toIso: string, limit: number) {
    return [...this.posts.values()].filter(p => p.scheduledFor >= fromIso && p.scheduledFor < toIso)
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)).slice(0, limit).map(p => ({ ...p }))
  }
  async updatePostContent(id: string, patch: ContentPatch) {
    const p = this.posts.get(id)
    if (!p) throw new SocialStoreError("post_not_found")
    const contentChanged = CONTENT_KEYS.some(k => k in patch && JSON.stringify(patch[k]) !== JSON.stringify(p[k]))
    if (contentChanged && LOCKED.includes(p.status)) throw new SocialStoreError("social_post_locked")
    const next: SocialPost = { ...p, ...patch, updatedAt: this.now() }
    if (contentChanged) {
      next.version = p.version + 1; next.qualityPassed = false; next.qualityReport = null; next.status = "draft"
      for (const a of this.approvals) if (a.postId === id && a.postVersion === p.version && (a.status === "pending" || a.status === "approved")) a.status = "expired"
    }
    this.posts.set(id, next)
    return { ...next }
  }
  async setQuality(id: string, version: number, report: QualityReport) {
    const p = this.posts.get(id)
    if (!p) throw new SocialStoreError("post_not_found")
    if (p.version !== version) throw new SocialStoreError("stale_version")
    if (!["draft", "qa_failed", "ready_for_review"].includes(p.status)) throw new SocialStoreError("post_not_editable")
    const next = { ...p, qualityPassed: report.passed, qualityReport: report, status: report.passed ? "ready_for_review" as const : "qa_failed" as const, updatedAt: this.now() }
    this.posts.set(id, next)
    return { ...next }
  }
  async requestApproval(postId: string, version: number) {
    const existing = this.approvals.find(a => a.postId === postId && a.postVersion === version)
    if (existing) return { ...existing }
    const now = this.clock()
    const a: SocialApproval = { id: this.id("appr"), postId, postVersion: version, status: "pending", requestedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 7 * 864e5).toISOString(), decidedBy: null, decidedAt: null }
    this.approvals.push(a)
    return { ...a }
  }
  async listApprovals(postId: string) { return this.approvals.filter(a => a.postId === postId).map(a => ({ ...a })) }
  async decideApproval(postId: string, version: number, approve: boolean, userId: string) {
    const p = this.posts.get(postId)
    if (!p) throw new SocialStoreError("post_not_found")
    if (p.version !== version) throw new SocialStoreError("stale_version")
    if (approve && (p.status !== "ready_for_review" || !p.qualityPassed)) throw new SocialStoreError("post_not_reviewable")
    const a = this.approvals.find(x => x.postId === postId && x.postVersion === version && x.status === "pending")
    if (!a) throw new SocialStoreError("approval_not_pending")
    if (Date.parse(a.expiresAt) <= this.clock().getTime()) { a.status = "expired"; throw new SocialStoreError("approval_expired") }
    a.status = approve ? "approved" : "rejected"; a.decidedBy = userId; a.decidedAt = this.now()
    const next = { ...p, status: approve ? "approved" as const : "rejected" as const, updatedAt: this.now() }
    this.posts.set(postId, next)
    return { ...next }
  }
  async enqueuePublish(postId: string, mode: ExecutionMode) {
    const c = this.control
    if (c.killSwitch) throw new SocialStoreError("kill_switch_active")
    if (mode === "live" && c.executionMode !== "live") throw new SocialStoreError("live_mode_disabled")
    const p = this.posts.get(postId)
    if (!p) throw new SocialStoreError("post_not_found")
    if (p.status !== "approved" && !(p.status === "ready_for_review" && c.organicAutoPublish)) throw new SocialStoreError("post_not_approved")
    if (!p.qualityPassed) throw new SocialStoreError("quality_not_passed")
    let approval: SocialApproval | undefined
    if (!c.organicAutoPublish) {
      approval = this.approvals.find(a => a.postId === p.id && a.postVersion === p.version && a.status === "approved" && a.decidedBy && Date.parse(a.expiresAt) > this.clock().getTime())
      if (!approval) throw new SocialStoreError("approval_missing")
    }
    let n = 0
    for (const platform of p.platforms) {
      if ((platform === "instagram" && !c.instagramEnabled) || (platform === "facebook" && !c.facebookEnabled)) continue
      const dup = [...this.jobs.values()].some(j => j.postId === p.id && j.platform === platform && j.executionMode === mode)
      if (dup) continue
      const job: PublishJob = {
        id: this.id("job"), postId: p.id, postVersion: p.version, platform, executionMode: mode,
        idempotencyKey: `social:${p.id}:v${p.version}:${platform}:${mode}`, status: "queued", attempt: 0, maxAttempts: 3,
        leaseToken: null, leasedUntil: null, scheduledAt: p.scheduledFor, externalContainerId: null, externalPostId: null, lastErrorCode: null,
      }
      this.jobs.set(job.id, job); n++
    }
    if (n === 0 && ![...this.jobs.values()].some(j => j.postId === p.id && j.executionMode === mode)) throw new SocialStoreError("no_enabled_platform")
    if (approval) approval.status = "consumed"
    this.posts.set(p.id, { ...p, status: "scheduled", updatedAt: this.now() })
    return n
  }
  async claimJobs(limit: number, leaseSeconds: number) {
    const now = this.clock().getTime()
    for (const j of this.jobs.values()) {
      if (j.status === "leased" && j.leasedUntil && Date.parse(j.leasedUntil) < now) {
        Object.assign(j, { status: "needs_review", lastErrorCode: "lease_expired", leaseToken: null, leasedUntil: null })
      }
    }
    if (this.control.killSwitch) return []
    const ready = [...this.jobs.values()]
      .filter(j => j.status === "queued" && Date.parse(j.scheduledAt) <= now && j.attempt < j.maxAttempts && (j.executionMode === "dry_run" || this.control.executionMode === "live"))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id))
      .slice(0, Math.max(1, Math.min(limit, 5)))
    return ready.map(j => {
      const token = this.id("lease")
      Object.assign(j, { status: "leased", attempt: j.attempt + 1, leaseToken: token, leasedUntil: new Date(now + Math.max(30, Math.min(leaseSeconds, 300)) * 1000).toISOString() })
      return { jobId: j.id, leaseToken: token }
    })
  }
  async getJob(id: string) { const j = this.jobs.get(id); return j ? { ...j } : null }
  async listJobs(limit: number) { return [...this.jobs.values()].reverse().slice(0, limit).map(j => ({ ...j })) }
  async recordContainer(jobId: string, token: string, containerId: string) {
    const j = this.jobs.get(jobId)
    if (!j || j.leaseToken !== token || j.status !== "leased" || (j.externalContainerId && j.externalContainerId !== containerId)) return false
    j.externalContainerId = containerId
    return true
  }
  private refresh(postId: string) {
    const jobs = [...this.jobs.values()].filter(j => j.postId === postId)
    const done = jobs.filter(j => j.status === "published" || j.status === "dry_run_completed").length
    const bad = jobs.filter(j => ["dead_letter", "needs_review", "failed"].includes(j.status)).length
    const p = this.posts.get(postId)
    if (!p || !["scheduled", "publishing", "partially_published", "failed"].includes(p.status)) return
    const status: SocialPost["status"] = jobs.length > 0 && done === jobs.length ? "published" : done > 0 && bad > 0 ? "partially_published" : bad > 0 && done === 0 ? "failed" : "publishing"
    this.posts.set(postId, { ...p, status })
  }
  async completeJob(jobId: string, token: string, externalPostId: string) {
    const j = this.jobs.get(jobId)
    if (!j || j.leaseToken !== token || j.status !== "leased") return false
    if (j.executionMode === "live" && [...this.jobs.values()].some(o => o.id !== j.id && o.postId === j.postId && o.platform === j.platform && o.status === "published")) {
      throw new SocialStoreError("duplicate_published")
    }
    Object.assign(j, { status: (j.executionMode === "dry_run" ? "dry_run_completed" : "published") as JobStatus, externalPostId, leaseToken: null, leasedUntil: null, lastErrorCode: null })
    this.refresh(j.postId)
    return true
  }
  async failJob(jobId: string, token: string, errorCode: string, retryable: boolean) {
    const j = this.jobs.get(jobId)
    if (!j || j.leaseToken !== token || j.status !== "leased") return "lease_lost"
    const next: JobStatus = errorCode === "unknown_outcome" || errorCode === "container_already_published" ? "needs_review"
      : retryable && j.attempt < j.maxAttempts ? "queued" : "dead_letter"
    Object.assign(j, {
      status: next, lastErrorCode: errorCode, leaseToken: null, leasedUntil: null,
      scheduledAt: next === "queued" ? new Date(this.clock().getTime() + 60_000 * 4 ** (j.attempt - 1)).toISOString() : j.scheduledAt,
    })
    this.refresh(j.postId)
    return next
  }
  async listMetrics(sinceDate: string) { return this.metrics.filter(m => m.metricDate >= sinceDate) }
  async insertAdDraft(draft: Omit<AdDraft, "id">) {
    if (draft.dailyBudgetUsd !== 0) throw new SocialStoreError("ads_budget_must_be_zero")
    const existing = this.adDrafts.find(d => d.idempotencyKey === draft.idempotencyKey)
    if (existing) return existing
    const d = { ...draft, id: this.id("ad") }
    this.adDrafts.push(d)
    return d
  }
  async listAdDrafts(limit: number) { return this.adDrafts.slice(-limit).reverse() }
  async listCandidateListings(limit: number) { return this.listings.slice(0, limit) }
}

export const PLATFORM_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", facebook: "Facebook" }
