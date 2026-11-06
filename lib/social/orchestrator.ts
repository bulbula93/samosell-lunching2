/**
 * Social Media Orchestrator — runs under the Main AI Ops Orchestrator as the `marketing` role.
 * Pipeline: Strategy → Creative → Quality → (human approval) → Publishing queue → Analytics.
 * Every step passes the Policy Gateway and writes an audit entry, including denials.
 */
import { draftAdPlan } from "./agents/ads-planner"
import { createDraft } from "./agents/creative"
import { checkQuality } from "./agents/quality"
import { buildWeeklyPlan, mondayOf } from "./agents/strategy"
import { evaluateSocialAction, type PolicyResult, type SocialAction, type SocialAgent } from "./policy-gateway"
import { effectiveExecutionMode, type SocialRuntime } from "./runtime"
import { SocialStoreError, type SocialStore } from "./store"
import type { CandidateListing, SocialPlatform, SocialPost } from "./types"

/** Registration with the Main Orchestrator (lib/ai-ops/policy.ts role catalog). */
export const SOCIAL_ORCHESTRATOR = Object.freeze({ parentRole: "coordinator", role: "marketing", name: "Social Media Orchestrator" } as const)

export class PolicyDeniedError extends Error {
  constructor(public readonly reason: string) { super(reason) }
}

type Ctx = { store: SocialStore; runtime: SocialRuntime; now?: () => Date }

async function gate(ctx: Ctx, actor: SocialAgent, action: SocialAction, extra: Partial<Parameters<typeof evaluateSocialAction>[0]> = {}, resource: { type: string; id: string | null } = { type: "system", id: null }): Promise<PolicyResult> {
  const control = await ctx.store.getControl()
  const result = evaluateSocialAction({ actor, action, runtime: ctx.runtime, control, now: ctx.now?.(), ...extra })
  if (result.decision === "deny") {
    await ctx.store.appendAudit({ actorType: actor === "human_admin" ? "human" : "agent", actor, action, decision: "deny", reason: result.reason, resourceType: resource.type, resourceId: resource.id })
  }
  return result
}

export type PlanningResult = { weekStart: string; created: number; existing: number; passedQa: number; failedQa: number; approvalsRequested: number; posts: SocialPost[] }

export async function runPlanningCycle(ctx: Ctx, input: { weekStart?: string; listings?: CandidateListing[] } = {}): Promise<PlanningResult> {
  const now = ctx.now?.() ?? new Date()
  const weekStart = input.weekStart ?? mondayOf(new Date(now.getTime() + 7 * 864e5))
  const planGate = await gate(ctx, "orchestrator", "plan_content")
  if (planGate.decision === "deny") throw new PolicyDeniedError(planGate.reason)

  const control = await ctx.store.getControl()
  const platforms: SocialPlatform[] = []
  if (control?.instagramEnabled) platforms.push("instagram")
  if (control?.facebookEnabled) platforms.push("facebook")
  const listings = input.listings ?? await ctx.store.listCandidateListings(40)
  const slots = buildWeeklyPlan({ weekStart, listings, platforms })
  await ctx.store.appendAudit({ actorType: "agent", actor: "strategy", action: "plan_content", decision: "success", reason: "weekly_plan_built", resourceType: "plan", resourceId: weekStart, details: { slots: slots.length, candidates: listings.length } })

  const result: PlanningResult = { weekStart, created: 0, existing: 0, passedQa: 0, failedQa: 0, approvalsRequested: 0, posts: [] }
  for (const slot of slots) {
    const draftGate = await gate(ctx, "creative", "create_draft")
    if (draftGate.decision === "deny") throw new PolicyDeniedError(draftGate.reason)
    const { post, created } = await ctx.store.insertDraft(createDraft(slot), { type: "agent", id: "creative" })
    if (!created) { result.existing++; result.posts.push(post); continue }
    result.created++
    await ctx.store.appendAudit({ actorType: "agent", actor: "creative", action: "create_draft", decision: "success", reason: "draft_created", resourceType: "social_post", resourceId: post.id, details: { pillar: post.pillar } })
    const checked = await runQualityCheck(ctx, post, "quality")
    if (checked.qualityPassed) {
      result.passedQa++
      const approvalGate = await gate(ctx, "quality", "request_approval", { post: checked }, { type: "social_post", id: checked.id })
      if (approvalGate.decision === "requires_approval") {
        await ctx.store.requestApproval(checked.id, checked.version)
        result.approvalsRequested++
        await ctx.store.appendAudit({ actorType: "agent", actor: "quality", action: "request_approval", decision: "requires_approval", reason: approvalGate.reason, resourceType: "social_post", resourceId: checked.id, details: { version: checked.version } })
      }
    } else result.failedQa++
    result.posts.push(checked)
  }
  return result
}

export async function runQualityCheck(ctx: Ctx, post: SocialPost, actor: SocialAgent = "quality"): Promise<SocialPost> {
  const g = await gate(ctx, actor, "run_quality_check", {}, { type: "social_post", id: post.id })
  if (g.decision === "deny") throw new PolicyDeniedError(g.reason)
  const report = checkQuality(post, ctx.now?.() ?? new Date())
  const updated = await ctx.store.setQuality(post.id, post.version, report)
  await ctx.store.appendAudit({ actorType: actor === "human_admin" ? "human" : "agent", actor, action: "run_quality_check", decision: report.passed ? "success" : "failure", reason: report.passed ? "quality_passed" : "quality_failed", resourceType: "social_post", resourceId: post.id, details: { score: report.score, errors: report.issues.filter(i => i.severity === "error").length } })
  return updated
}

/** Human approval → immediately queue (dry-run unless every live gate is open). */
export async function approveAndSchedule(ctx: Ctx, postId: string, version: number, adminUserId: string) {
  const post = await ctx.store.getPost(postId)
  if (!post) throw new SocialStoreError("post_not_found")
  if (post.version !== version) throw new SocialStoreError("stale_version")
  const g = await gate(ctx, "human_admin", "approve_post", { post }, { type: "social_post", id: postId })
  if (g.decision === "deny") throw new PolicyDeniedError(g.reason)
  const approved = await ctx.store.decideApproval(postId, version, true, adminUserId)
  await ctx.store.appendAudit({ actorType: "human", actor: adminUserId, action: "approve_post", decision: "allow", reason: "human_approval", resourceType: "social_post", resourceId: postId, details: { version } })
  return enqueue(ctx, approved, "human_admin")
}

export async function rejectPost(ctx: Ctx, postId: string, version: number, adminUserId: string) {
  const g = await gate(ctx, "human_admin", "reject_post", {}, { type: "social_post", id: postId })
  if (g.decision === "deny") throw new PolicyDeniedError(g.reason)
  const post = await ctx.store.decideApproval(postId, version, false, adminUserId)
  await ctx.store.appendAudit({ actorType: "human", actor: adminUserId, action: "reject_post", decision: "success", reason: "human_rejection", resourceType: "social_post", resourceId: postId, details: { version } })
  return post
}

export async function enqueue(ctx: Ctx, post: SocialPost, actor: SocialAgent) {
  const approvals = await ctx.store.listApprovals(post.id)
  const g = await gate(ctx, actor, "enqueue_publish", { post, approvals }, { type: "social_post", id: post.id })
  if (g.decision === "deny") throw new PolicyDeniedError(g.reason)
  if (g.decision === "requires_approval") throw new PolicyDeniedError(g.reason)
  const control = await ctx.store.getControl()
  const mode = g.decision === "allow" && control ? effectiveExecutionMode(ctx.runtime, control.executionMode) : "dry_run"
  const jobs = await ctx.store.enqueuePublish(post.id, mode)
  await ctx.store.appendAudit({ actorType: actor === "human_admin" ? "human" : "agent", actor, action: "enqueue_publish", decision: mode === "live" ? "allow" : "dry_run", reason: g.reason, resourceType: "social_post", resourceId: post.id, details: { jobs, mode } })
  return { jobs, mode }
}

export async function draftAdForPost(ctx: Ctx, postId: string) {
  const post = await ctx.store.getPost(postId)
  if (!post) throw new SocialStoreError("post_not_found")
  const g = await gate(ctx, "ads_planner", "draft_ad_plan", { budgetUsd: 0 }, { type: "social_post", id: postId })
  if (g.decision === "deny") throw new PolicyDeniedError(g.reason)
  const draft = await ctx.store.insertAdDraft(draftAdPlan(post))
  await ctx.store.appendAudit({ actorType: "agent", actor: "ads_planner", action: "draft_ad_plan", decision: "success", reason: "draft_only_zero_budget", resourceType: "social_ad_draft", resourceId: draft.id })
  return draft
}
