/**
 * Policy Gateway — the single authorization point for every Social Media agent action.
 * Deny by default. Pure and synchronous so it can be unit-tested exhaustively.
 * The database re-checks the publishing gate (social_enqueue_publish) as defense in depth.
 * A model or agent output can never satisfy a check by itself: approvals are passed in
 * only after the server loaded them from the database.
 */
import { effectiveExecutionMode, SOCIAL_POLICY, type SocialRuntime } from "./runtime"
import type { AnyPlatform, SocialApproval, SocialControl, SocialPost } from "./types"

export const SOCIAL_AGENTS = ["orchestrator", "strategy", "creative", "quality", "publishing", "analytics", "community", "ads_planner", "human_admin", "system"] as const
export type SocialAgent = (typeof SOCIAL_AGENTS)[number]

export const SOCIAL_ACTIONS = [
  "plan_content", "create_draft", "edit_draft", "run_quality_check", "request_approval",
  "approve_post", "reject_post", "enqueue_publish", "publish_organic",
  "read_metrics", "sync_metrics", "draft_community_reply", "send_community_reply",
  "draft_ad_plan", "create_paid_ad", "activate_paid_ad", "modify_ad_spend", "modify_existing_campaign",
  "change_settings", "kill_switch_on", "kill_switch_off",
] as const
export type SocialAction = (typeof SOCIAL_ACTIONS)[number]

const PAID_ACTIONS: ReadonlySet<SocialAction> = new Set(["create_paid_ad", "activate_paid_ad", "modify_ad_spend", "modify_existing_campaign"])
/** Actions that still work while the kill switch is engaged (observing and stopping). */
const KILL_SWITCH_EXEMPT: ReadonlySet<SocialAction> = new Set(["read_metrics", "reject_post", "kill_switch_on", "kill_switch_off", "change_settings"])

const ALLOWED_AGENTS: Record<SocialAction, readonly SocialAgent[]> = {
  plan_content: ["orchestrator", "strategy", "human_admin"],
  create_draft: ["orchestrator", "creative", "human_admin"],
  edit_draft: ["creative", "human_admin"],
  run_quality_check: ["orchestrator", "quality", "human_admin"],
  request_approval: ["orchestrator", "quality"],
  approve_post: ["human_admin"],
  reject_post: ["human_admin"],
  enqueue_publish: ["orchestrator", "publishing", "human_admin"],
  publish_organic: ["publishing", "system"],
  read_metrics: ["orchestrator", "analytics", "human_admin"],
  sync_metrics: ["analytics", "system"],
  draft_community_reply: ["community"],
  send_community_reply: ["community", "human_admin"],
  draft_ad_plan: ["ads_planner"],
  create_paid_ad: [],
  activate_paid_ad: [],
  modify_ad_spend: [],
  modify_existing_campaign: [],
  change_settings: ["human_admin"],
  kill_switch_on: ["human_admin", "system"],
  kill_switch_off: ["human_admin"],
}

export type PolicyDecision = "allow" | "deny" | "dry_run" | "requires_approval"
export type PolicyResult = { decision: PolicyDecision; reason: string }

export type PolicyInput = {
  actor: SocialAgent
  action: SocialAction
  runtime: SocialRuntime
  control: SocialControl | null
  platform?: AnyPlatform
  post?: Pick<SocialPost, "id" | "status" | "version" | "qualityPassed" | "platforms"> | null
  /** Approval rows loaded server-side for this post. Never from a request body or model output. */
  approvals?: readonly SocialApproval[]
  /** For ad-related actions: the budget the actor tries to use. */
  budgetUsd?: number
  /** For settings changes. */
  settings?: { organicAutoPublish?: boolean; executionMode?: "dry_run" | "live" }
  now?: Date
}

const deny = (reason: string): PolicyResult => ({ decision: "deny", reason })
const allow = (reason: string): PolicyResult => ({ decision: "allow", reason })

function platformEnabled(control: SocialControl, platform: AnyPlatform) {
  if (platform === "tiktok") return false
  if (!SOCIAL_POLICY.platforms[platform]) return false
  return platform === "instagram" ? control.instagramEnabled : control.facebookEnabled
}

export function hasValidApproval(post: NonNullable<PolicyInput["post"]>, approvals: readonly SocialApproval[], now: Date) {
  return approvals.some(a => a.postId === post.id && a.postVersion === post.version && a.status === "approved" &&
    Boolean(a.decidedBy) && Date.parse(a.expiresAt) > now.getTime())
}

export function evaluateSocialAction(input: PolicyInput): PolicyResult {
  const { action, actor, runtime, control } = input
  const now = input.now ?? new Date()

  // 1. Paid advertising is forbidden in v1 — no actor, approval, environment or setting can unlock it.
  if (PAID_ACTIONS.has(action)) return deny("paid_ads_forbidden")
  if (input.budgetUsd !== undefined && input.budgetUsd !== SOCIAL_POLICY.dailyAdsBudgetUsd) return deny("ads_budget_must_be_zero")

  // 2. Role check.
  if (!ALLOWED_AGENTS[action].includes(actor)) return deny("actor_not_authorized")

  // 3. Platform policy.
  if (input.platform === "tiktok") return deny("platform_disabled_tiktok")

  // 4. Control row must exist and be sane; otherwise fail closed.
  if (!control) return action === "read_metrics" ? allow("read_only") : deny("control_unavailable")
  if (control.dailyAdsBudgetUsd !== 0 || control.paidAdsCreateAllowed || control.paidAdsActivateAllowed || control.paidAdsSpendModifyAllowed || control.tiktokEnabled) {
    return deny("control_policy_violation")
  }

  // 5. Kill switch stops every agent action that could produce or ship content.
  if (control.killSwitch && !KILL_SWITCH_EXEMPT.has(action)) return deny("kill_switch_active")

  switch (action) {
    case "read_metrics":
    case "plan_content":
    case "create_draft":
    case "edit_draft":
    case "run_quality_check":
    case "draft_community_reply":
    case "reject_post":
    case "kill_switch_on":
      return allow("internal_or_draft_action")
    case "draft_ad_plan":
      return input.budgetUsd === 0 ? allow("draft_only_zero_budget") : deny("ads_budget_must_be_zero")
    case "kill_switch_off":
      return allow("human_admin_resume")
    case "change_settings": {
      if (input.settings?.executionMode === "live" && runtime.executionModeCeiling !== "live") return deny(runtime.liveReason)
      if (input.settings?.organicAutoPublish === true && runtime.environment === "production" && runtime.executionModeCeiling !== "live") {
        return deny("auto_publish_requires_live_rollout")
      }
      return allow("settings_change")
    }
    case "send_community_reply":
      // v1: community replies are draft-only. Sending needs pages_manage_engagement and a separate review.
      return deny("community_send_disabled_v1")
    case "sync_metrics":
      return runtime.backendAllowed ? allow("metrics_sync") : deny(runtime.backendReason)
    case "request_approval": {
      if (!input.post) return deny("post_missing")
      if (!input.post.qualityPassed) return deny("quality_not_passed")
      return { decision: "requires_approval", reason: "organic_post_needs_human_approval" }
    }
    case "approve_post": {
      if (!input.post) return deny("post_missing")
      if (!input.post.qualityPassed) return deny("quality_not_passed")
      if (input.post.status !== "ready_for_review") return deny("post_not_reviewable")
      return allow("human_approval")
    }
    case "enqueue_publish":
    case "publish_organic": {
      const post = input.post
      if (!post) return deny("post_missing")
      if (!post.qualityPassed) return deny("quality_not_passed")
      const platforms = input.platform ? [input.platform] : post.platforms
      if (platforms.length === 0 || !platforms.every(p => platformEnabled(control, p))) return deny("platform_disabled")
      if (action === "enqueue_publish") {
        const approved = hasValidApproval(post, input.approvals ?? [], now)
        const autoOk = control.organicAutoPublish && post.status === "ready_for_review"
        if (!approved && !autoOk) return { decision: "requires_approval", reason: "approval_missing" }
        if (post.status !== "approved" && !autoOk) return deny("post_not_approved")
      } else if (!["scheduled", "publishing", "partially_published", "failed"].includes(post.status)) {
        return deny("post_not_scheduled")
      }
      const mode = effectiveExecutionMode(runtime, control.executionMode)
      return mode === "live" ? allow("live_publish_allowed") : { decision: "dry_run", reason: control.executionMode === "live" ? runtime.liveReason : "control_dry_run" }
    }
  }
  return deny("unknown_action")
}
