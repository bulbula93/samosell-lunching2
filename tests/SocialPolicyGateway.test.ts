// @vitest-environment node
import { describe, expect, it } from "vitest"
import { evaluateSocialAction, SOCIAL_ACTIONS, SOCIAL_AGENTS, type PolicyInput } from "@/lib/social/policy-gateway"
import { resolveSocialRuntime, SOCIAL_POLICY } from "@/lib/social/runtime"
import { defaultControl } from "@/lib/social/store"
import type { SocialApproval, SocialControl } from "@/lib/social/types"

const NOW = new Date("2026-11-10T10:00:00Z")
const preview = resolveSocialRuntime({ VERCEL_ENV: "preview", SOCIAL_AGENT_OS_ENABLED: "true", SOCIAL_QA_DATABASE_REF: "ydocqjdjmffysexkzxyc", NEXT_PUBLIC_SUPABASE_URL: "https://ydocqjdjmffysexkzxyc.supabase.co" })
const prodLive = resolveSocialRuntime({ VERCEL_ENV: "production", SOCIAL_AGENT_OS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co", SOCIAL_EXECUTION_MODE: "live", SOCIAL_LIVE_PUBLISHING_ENABLED: "true" })
const running = (over: Partial<SocialControl> = {}): SocialControl => ({ ...defaultControl(NOW.toISOString()), killSwitch: false, ...over })
const post = { id: "p1", status: "approved" as const, version: 2, qualityPassed: true, platforms: ["instagram", "facebook"] as ("instagram" | "facebook")[] }
const approval = (over: Partial<SocialApproval> = {}): SocialApproval => ({ id: "a1", postId: "p1", postVersion: 2, status: "approved", requestedAt: NOW.toISOString(), expiresAt: "2026-11-12T00:00:00Z", decidedBy: "admin-1", decidedAt: NOW.toISOString(), ...over })
const ev = (over: Partial<PolicyInput>) => evaluateSocialAction({ actor: "publishing", action: "publish_organic", runtime: preview, control: running(), now: NOW, ...over })

describe("paid budget is zero and paid ads are forbidden", () => {
  it("mandatory policy constants", () => {
    expect(SOCIAL_POLICY.dailyAdsBudgetUsd).toBe(0)
    expect(SOCIAL_POLICY.paidAdsCreate).toBe(false)
    expect(SOCIAL_POLICY.paidAdsActivate).toBe(false)
    expect(SOCIAL_POLICY.paidAdsSpendModify).toBe(false)
    expect(SOCIAL_POLICY.platforms.tiktok).toBe(false)
    expect(SOCIAL_POLICY.initialExecutionMode).toBe("dry_run")
  })
  for (const action of ["create_paid_ad", "activate_paid_ad", "modify_ad_spend", "modify_existing_campaign"] as const) {
    it(`${action} is denied for every actor, even in fully-open production live mode`, () => {
      for (const actor of SOCIAL_AGENTS) {
        expect(evaluateSocialAction({ actor, action, runtime: prodLive, control: running({ executionMode: "live", organicAutoPublish: true }), budgetUsd: 0, approvals: [approval()], post })).toEqual({ decision: "deny", reason: "paid_ads_forbidden" })
      }
    })
  }
  it("any non-zero budget is denied, including for draft ad plans", () => {
    expect(ev({ actor: "ads_planner", action: "draft_ad_plan", budgetUsd: 5 }).reason).toBe("ads_budget_must_be_zero")
    expect(ev({ actor: "ads_planner", action: "draft_ad_plan", budgetUsd: 0.01 }).decision).toBe("deny")
    expect(ev({ actor: "ads_planner", action: "draft_ad_plan" }).decision).toBe("deny")
    expect(ev({ actor: "ads_planner", action: "draft_ad_plan", budgetUsd: 0 })).toEqual({ decision: "allow", reason: "draft_only_zero_budget" })
  })
  it("a tampered control row with a budget or paid flag fails closed for everything except reads", () => {
    const bad = [{ dailyAdsBudgetUsd: 5 }, { paidAdsActivateAllowed: true }, { tiktokEnabled: true }] as unknown as Partial<SocialControl>[]
    for (const b of bad) {
      expect(ev({ control: running(b), post: { ...post, status: "scheduled" } }).reason).toBe("control_policy_violation")
      expect(ev({ actor: "orchestrator", action: "plan_content", control: running(b) }).reason).toBe("control_policy_violation")
    }
  })
})

describe("platforms, kill switch and roles", () => {
  it("TikTok is always denied", () => {
    expect(ev({ platform: "tiktok", post: { ...post, status: "scheduled" } }).reason).toBe("platform_disabled_tiktok")
  })
  it("disabled platform denies publishing", () => {
    expect(ev({ platform: "instagram", control: running({ instagramEnabled: false }), post: { ...post, status: "scheduled" } }).reason).toBe("platform_disabled")
  })
  it("kill switch blocks content actions but not observation or rejection", () => {
    const control = running({ killSwitch: true })
    for (const [actor, action] of [["orchestrator", "plan_content"], ["creative", "create_draft"], ["quality", "run_quality_check"], ["publishing", "publish_organic"], ["orchestrator", "enqueue_publish"]] as const) {
      expect(ev({ actor, action, control, post }).reason).toBe("kill_switch_active")
    }
    expect(ev({ actor: "analytics", action: "read_metrics", control }).decision).toBe("allow")
    expect(ev({ actor: "human_admin", action: "reject_post", control }).decision).toBe("allow")
    expect(ev({ actor: "human_admin", action: "kill_switch_off", control }).decision).toBe("allow")
  })
  it("missing control row fails closed", () => {
    expect(ev({ actor: "orchestrator", action: "plan_content", control: null }).reason).toBe("control_unavailable")
  })
  it("only humans approve; agents cannot approve their own content", () => {
    for (const actor of SOCIAL_AGENTS.filter(a => a !== "human_admin")) {
      expect(ev({ actor, action: "approve_post", post: { ...post, status: "ready_for_review" } }).reason).toBe("actor_not_authorized")
    }
  })
  it("every action has a deterministic decision for every actor (no throws, deny-by-default)", () => {
    for (const actor of SOCIAL_AGENTS) for (const action of SOCIAL_ACTIONS) {
      const r = ev({ actor, action })
      expect(["allow", "deny", "dry_run", "requires_approval"]).toContain(r.decision)
    }
  })
  it("community replies are draft-only in v1", () => {
    expect(ev({ actor: "community", action: "draft_community_reply" }).decision).toBe("allow")
    expect(ev({ actor: "community", action: "send_community_reply" }).reason).toBe("community_send_disabled_v1")
  })
})

describe("approval and execution mode", () => {
  const enq = (over: Partial<PolicyInput>) => ev({ actor: "orchestrator", action: "enqueue_publish", post, ...over })
  it("enqueue without a valid approval requires approval", () => {
    expect(enq({ approvals: [] }).decision).toBe("requires_approval")
    expect(enq({ approvals: [approval({ postVersion: 1 })] }).decision).toBe("requires_approval")
    expect(enq({ approvals: [approval({ expiresAt: "2026-11-01T00:00:00Z" })] }).decision).toBe("requires_approval")
    expect(enq({ approvals: [approval({ decidedBy: null })] }).decision).toBe("requires_approval")
    expect(enq({ approvals: [approval({ status: "consumed" })] }).decision).toBe("requires_approval")
  })
  it("valid approval in preview → dry_run only", () => {
    expect(enq({ approvals: [approval()] })).toEqual({ decision: "dry_run", reason: "control_dry_run" })
    expect(enq({ approvals: [approval()], control: running({ executionMode: "live" }) })).toEqual({ decision: "dry_run", reason: "non_production_always_dry_run" })
  })
  it("live requires production + env flags + DB live mode", () => {
    expect(enq({ runtime: prodLive, approvals: [approval()] }).decision).toBe("dry_run")
    expect(enq({ runtime: prodLive, approvals: [approval()], control: running({ executionMode: "live" }) })).toEqual({ decision: "allow", reason: "live_publish_allowed" })
  })
  it("QA must pass before approval request, approval or enqueue", () => {
    const failed = { ...post, qualityPassed: false }
    expect(ev({ actor: "quality", action: "request_approval", post: failed }).reason).toBe("quality_not_passed")
    expect(ev({ actor: "human_admin", action: "approve_post", post: { ...failed, status: "ready_for_review" } }).reason).toBe("quality_not_passed")
    expect(enq({ post: failed, approvals: [approval()] }).reason).toBe("quality_not_passed")
  })
  it("organic auto-publish skips the human approval only when enabled", () => {
    const review = { ...post, status: "ready_for_review" as const }
    expect(enq({ post: review }).decision).toBe("requires_approval")
    expect(enq({ post: review, control: running({ organicAutoPublish: true }) }).decision).toBe("dry_run")
  })
  it("settings cannot switch to live outside a live-capable production runtime", () => {
    expect(ev({ actor: "human_admin", action: "change_settings", settings: { executionMode: "live" } }).decision).toBe("deny")
    expect(ev({ actor: "human_admin", action: "change_settings", runtime: prodLive, settings: { executionMode: "live" } }).decision).toBe("allow")
  })
})

describe("runtime resolution fails closed", () => {
  it("disabled by default", () => {
    const r = resolveSocialRuntime({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co" })
    expect(r.backendAllowed).toBe(false)
    expect(r.executionModeCeiling).toBe("dry_run")
  })
  it("preview can never use the production database or go live", () => {
    const r = resolveSocialRuntime({ VERCEL_ENV: "preview", SOCIAL_AGENT_OS_ENABLED: "true", SOCIAL_QA_DATABASE_REF: "ydocqjdjmffysexkzxyc", NEXT_PUBLIC_SUPABASE_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co", SOCIAL_EXECUTION_MODE: "live", SOCIAL_LIVE_PUBLISHING_ENABLED: "true" })
    expect(r.backendAllowed).toBe(false)
    expect(r.executionModeCeiling).toBe("dry_run")
  })
  it("read-only preview has no backend", () => {
    expect(resolveSocialRuntime({ VERCEL_ENV: "preview", SOCIAL_AGENT_OS_ENABLED: "true", NEXT_PUBLIC_PREVIEW_READ_ONLY: "true", SOCIAL_QA_DATABASE_REF: "ydocqjdjmffysexkzxyc", NEXT_PUBLIC_SUPABASE_URL: "https://ydocqjdjmffysexkzxyc.supabase.co" }).backendAllowed).toBe(false)
  })
  it("production live needs both env flags", () => {
    const base = { VERCEL_ENV: "production", SOCIAL_AGENT_OS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co" }
    expect(resolveSocialRuntime({ ...base, SOCIAL_EXECUTION_MODE: "live" }).executionModeCeiling).toBe("dry_run")
    expect(resolveSocialRuntime({ ...base, SOCIAL_LIVE_PUBLISHING_ENABLED: "true" }).executionModeCeiling).toBe("dry_run")
  })
})
