/**
 * Social Media Orchestrator — runs under the Main AI Ops Orchestrator as the `marketing` role.
 * Pipeline: Strategy → Creative → Quality → (human approval) → Publishing queue → Analytics.
 * Every step passes the Policy Gateway and writes an audit entry, including denials.
 */
import { draftAdPlan } from "./agents/ads-planner"
import { createDraft, createStoryDraft, storyKey, storyPriceLabel } from "./agents/creative"
import { checkQuality } from "./agents/quality"
import { buildWeeklyPlan, mondayOf } from "./agents/strategy"
import { MediaPrepareError, type MediaPreparer, type StoryPreparer } from "./media"
import { evaluateSocialAction, type PolicyResult, type SocialAction, type SocialAgent } from "./policy-gateway"
import { effectiveExecutionMode, type SocialRuntime } from "./runtime"
import { SocialStoreError, type SocialStore } from "./store"
import type { CandidateListing, SocialPlatform, SocialPost } from "./types"

/** Registration with the Main Orchestrator (lib/ai-ops/policy.ts role catalog). */
export const SOCIAL_ORCHESTRATOR = Object.freeze({ parentRole: "coordinator", role: "marketing", name: "Social Media Orchestrator" } as const)

export class PolicyDeniedError extends Error {
  constructor(public readonly reason: string) { super(reason) }
}

type Ctx = { store: SocialStore; runtime: SocialRuntime; now?: () => Date; prepareMedia?: MediaPreparer | null; prepareStory?: StoryPreparer | null }

async function gate(ctx: Ctx, actor: SocialAgent, action: SocialAction, extra: Partial<Parameters<typeof evaluateSocialAction>[0]> = {}, resource: { type: string; id: string | null } = { type: "system", id: null }): Promise<PolicyResult> {
  const control = await ctx.store.getControl()
  const result = evaluateSocialAction({ actor, action, runtime: ctx.runtime, control, now: ctx.now?.(), ...extra })
  if (result.decision === "deny") {
    await ctx.store.appendAudit({ actorType: actor === "human_admin" ? "human" : "agent", actor, action, decision: "deny", reason: result.reason, resourceType: resource.type, resourceId: resource.id })
  }
  return result
}

export type PlanningResult = { weekStart: string; created: number; existing: number; passedQa: number; failedQa: number; approvalsRequested: number; storiesCreated: number; posts: SocialPost[] }

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

  const result: PlanningResult = { weekStart, created: 0, existing: 0, passedQa: 0, failedQa: 0, approvalsRequested: 0, storiesCreated: 0, posts: [] }
  for (const slot of slots) {
    const draftGate = await gate(ctx, "creative", "create_draft")
    if (draftGate.decision === "deny") throw new PolicyDeniedError(draftGate.reason)
    const inserted = await ctx.store.insertDraft(createDraft(slot), { type: "agent", id: "creative" })
    if (!inserted.created) { result.existing++; result.posts.push(inserted.post); continue }
    result.created++
    await ctx.store.appendAudit({ actorType: "agent", actor: "creative", action: "create_draft", decision: "success", reason: "draft_created", resourceType: "social_post", resourceId: inserted.post.id, details: { pillar: inserted.post.pillar } })
    // Instagram needs 4:5–1.91:1 JPEGs; convert listing photos once instead of dropping Instagram.
    const post = slot.platforms.includes("instagram")
      ? await tryPrepareInstagram(ctx, inserted.post, "creative").catch(() => inserted.post)
      : inserted.post
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
    if (control?.storiesEnabled && slot.listing && (checked.pillar === "featured_listing" || checked.pillar === "giveaway")) {
      const story = await tryCreateStory(ctx, checked, slot.listing, "creative").catch(() => null)
      if (story) { result.storiesCreated++; result.posts.push(story) }
    }
  }
  return result
}

/** QA → approval request, exactly like a feed draft. */
async function qaAndRequestApproval(ctx: Ctx, post: SocialPost, actor: SocialAgent): Promise<SocialPost> {
  const checked = await runQualityCheck(ctx, post, actor === "human_admin" ? "human_admin" : "quality")
  if (!checked.qualityPassed) return checked
  const approvalGate = await gate(ctx, "quality", "request_approval", { post: checked }, { type: "social_post", id: checked.id })
  if (approvalGate.decision === "requires_approval") {
    await ctx.store.requestApproval(checked.id, checked.version)
    await ctx.store.appendAudit({ actorType: "agent", actor: "quality", action: "request_approval", decision: "requires_approval", reason: approvalGate.reason, resourceType: "social_post", resourceId: checked.id, details: { version: checked.version } })
  }
  return checked
}

/**
 * Story companion for a product post: rendered 9:16 image → its own post row (own QA, approval, jobs).
 * Idempotent: an existing companion is returned without re-rendering.
 */
async function tryCreateStory(ctx: Ctx, feed: SocialPost, listing: CandidateListing, actor: "creative" | string): Promise<SocialPost | null> {
  if (!ctx.prepareStory) return null
  const existing = await ctx.store.getPostByKey(storyKey(feed.idempotencyKey))
  if (existing) return existing
  const control = await ctx.store.getControl()
  const platforms: SocialPlatform[] = []
  if (control?.instagramEnabled) platforms.push("instagram")
  if (control?.facebookEnabled) platforms.push("facebook")
  if (platforms.length === 0) return null
  const actorType = actor === "creative" ? "agent" as const : "human" as const
  let url: string
  try {
    url = await ctx.prepareStory({ id: listing.id, imageUrl: listing.imageUrl, title: listing.title, priceLabel: storyPriceLabel(listing), city: listing.city })
  } catch (e) {
    const code = e instanceof MediaPrepareError ? e.code : "story_render_failed"
    await ctx.store.appendAudit({ actorType, actor, action: "create_draft", decision: "failure", reason: code, resourceType: "social_post", resourceId: feed.id })
    throw e
  }
  const { post, created } = await ctx.store.insertDraft(createStoryDraft({ ...feed, platforms }, listing, url), { type: actorType, id: actor })
  if (!created) return post
  await ctx.store.appendAudit({ actorType, actor, action: "create_draft", decision: "success", reason: "story_draft_created", resourceType: "social_post", resourceId: post.id, details: { feed_post: feed.id } })
  return qaAndRequestApproval(ctx, post, actorType === "agent" ? "quality" : "human_admin")
}

/** Admin "🎬 Story-ც": add a Story companion to an existing product post. */
export async function addStoryForPost(ctx: Ctx, postId: string, adminUserId: string) {
  const feed = await ctx.store.getPost(postId)
  if (!feed) throw new SocialStoreError("post_not_found")
  if (feed.contentType === "story" || !feed.listingId) throw new SocialStoreError("story_needs_listing_post")
  const g = await gate(ctx, "human_admin", "edit_draft", {}, { type: "social_post", id: postId })
  if (g.decision === "deny") throw new PolicyDeniedError(g.reason)
  const control = await ctx.store.getControl()
  if (!control?.storiesEnabled) throw new PolicyDeniedError("stories_disabled")
  if (!ctx.prepareStory) throw new SocialStoreError("media_preparer_unavailable")
  const listing = await ctx.store.getCandidateListing(feed.listingId)
  if (!listing) throw new SocialStoreError("listing_unavailable")
  const story = await tryCreateStory(ctx, feed, listing, adminUserId)
  if (!story) throw new PolicyDeniedError("no_enabled_platform")
  return story
}

/** One click approves the feed post and, if it is waiting too, its Story companion. */
export async function approvePostAndStory(ctx: Ctx, postId: string, version: number, adminUserId: string) {
  const feed = await approveAndSchedule(ctx, postId, version, adminUserId)
  const post = await ctx.store.getPost(postId)
  const story = post && post.contentType !== "story" ? await ctx.store.getPostByKey(storyKey(post.idempotencyKey)) : null
  let storyResult: Awaited<ReturnType<typeof approveAndSchedule>> | null = null
  if (story && story.status === "ready_for_review") {
    storyResult = await approveAndSchedule(ctx, story.id, story.version, adminUserId).catch(() => null)
  }
  return { feed, story: storyResult }
}

/**
 * Convert the post's media into Instagram-ready JPEGs and add Instagram as a platform.
 * Returns the post unchanged when there is nothing to do; audits both success and failure.
 */
async function tryPrepareInstagram(ctx: Ctx, post: SocialPost, actor: SocialAgent | string): Promise<SocialPost> {
  if (!ctx.prepareMedia) return post
  const actorType = actor === "creative" ? "agent" as const : "human" as const
  try {
    const mediaUrls = await ctx.prepareMedia(post.mediaUrls)
    const platforms: SocialPlatform[] = post.platforms.includes("instagram") ? post.platforms : ["instagram", ...post.platforms]
    const unchanged = mediaUrls.length === post.mediaUrls.length && mediaUrls.every((u, i) => u === post.mediaUrls[i]) && platforms.length === post.platforms.length
    if (unchanged) return post
    const updated = await ctx.store.updatePostContent(post.id, { mediaUrls, platforms })
    await ctx.store.appendAudit({ actorType, actor, action: "edit_draft", decision: "success", reason: "instagram_media_prepared", resourceType: "social_post", resourceId: post.id, details: { images: mediaUrls.length, version: updated.version } })
    return updated
  } catch (e) {
    const code = e instanceof MediaPrepareError ? e.code : "media_prepare_failed"
    await ctx.store.appendAudit({ actorType, actor, action: "edit_draft", decision: "failure", reason: code, resourceType: "social_post", resourceId: post.id })
    throw e
  }
}

/** Admin "Instagram-ზეც": prepare media, re-run QA, request a fresh approval for the new version. */
export async function enableInstagramForPost(ctx: Ctx, postId: string, version: number, adminUserId: string) {
  const post = await ctx.store.getPost(postId)
  if (!post) throw new SocialStoreError("post_not_found")
  if (post.version !== version) throw new SocialStoreError("stale_version")
  const g = await gate(ctx, "human_admin", "edit_draft", {}, { type: "social_post", id: postId })
  if (g.decision === "deny") throw new PolicyDeniedError(g.reason)
  const control = await ctx.store.getControl()
  if (!control?.instagramEnabled) throw new PolicyDeniedError("instagram_disabled")
  if (!ctx.prepareMedia) throw new SocialStoreError("media_preparer_unavailable")
  const updated = await tryPrepareInstagram(ctx, post, adminUserId)
  const checked = await runQualityCheck(ctx, updated, "human_admin")
  if (checked.qualityPassed) await ctx.store.requestApproval(checked.id, checked.version)
  return checked
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
