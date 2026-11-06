/**
 * Environment resolution for the Social Media Agent OS.
 * Everything fails closed: unknown environment → dry-run, no backend, no live publishing.
 */
import type { ExecutionMode, RuntimeEnvironment } from "./types"

export const SOCIAL_QA_PROJECT_REF = "ydocqjdjmffysexkzxyc"
export const SOCIAL_PRODUCTION_PROJECT_REF = "lxsvjzbiuewgwpajqrwr"

/** Mandatory v1 policy. These are product decisions, not tunables. */
export const SOCIAL_POLICY = Object.freeze({
  platforms: Object.freeze({ instagram: true, facebook: true, tiktok: false }),
  approvalMode: "paid" as const,
  dailyAdsBudgetUsd: 0,
  paidAdsCreate: false,
  paidAdsActivate: false,
  paidAdsSpendModify: false,
  organicAutoPublishTarget: true,
  organicAutoPublishProductionInitial: false,
  initialExecutionMode: "dry_run" as const,
})

export type SocialEnv = Partial<Record<
  | "VERCEL_ENV" | "NODE_ENV" | "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_PREVIEW_READ_ONLY"
  | "SOCIAL_AGENT_OS_ENABLED" | "SOCIAL_QA_DATABASE_REF" | "SOCIAL_EXECUTION_MODE"
  | "SOCIAL_LIVE_PUBLISHING_ENABLED" | "SOCIAL_WORKER_ENABLED", string | undefined>>

export type SocialRuntime = {
  environment: RuntimeEnvironment
  /** May the server read/write Social tables at all? */
  backendAllowed: boolean
  backendReason: string
  /** Upper bound for execution. The DB control row can only narrow this further. */
  executionModeCeiling: ExecutionMode
  liveReason: string
  workerEnabled: boolean
}

export function resolveEnvironment(env: SocialEnv): RuntimeEnvironment {
  if (env.VERCEL_ENV === "production") return "production"
  if (env.VERCEL_ENV === "preview") return "preview"
  if (env.NODE_ENV === "test") return "test"
  return "development"
}

export function resolveSocialRuntime(env: SocialEnv): SocialRuntime {
  const environment = resolveEnvironment(env)
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  let backendAllowed = false
  let backendReason = "social_backend_not_configured"
  if (env.SOCIAL_AGENT_OS_ENABLED !== "true") {
    backendReason = "social_os_disabled"
  } else if (environment === "production") {
    backendAllowed = url === `https://${SOCIAL_PRODUCTION_PROJECT_REF}.supabase.co`
    backendReason = backendAllowed ? "production_backend" : "production_url_mismatch"
  } else if (env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") {
    backendReason = "preview_read_only"
  } else {
    // Every non-production environment may only ever talk to the named QA project.
    backendAllowed = env.SOCIAL_QA_DATABASE_REF === SOCIAL_QA_PROJECT_REF && url === `https://${SOCIAL_QA_PROJECT_REF}.supabase.co`
    backendReason = backendAllowed ? "qa_backend" : "qa_backend_not_allowed"
  }

  // Live publishing requires: production + backend + two independent explicit flags.
  let executionModeCeiling: ExecutionMode = "dry_run"
  let liveReason = "dry_run_default"
  if (environment !== "production") liveReason = "non_production_always_dry_run"
  else if (!backendAllowed) liveReason = backendReason
  else if (env.SOCIAL_EXECUTION_MODE !== "live") liveReason = "execution_mode_env_dry_run"
  else if (env.SOCIAL_LIVE_PUBLISHING_ENABLED !== "true") liveReason = "live_publishing_env_disabled"
  else { executionModeCeiling = "live"; liveReason = "live_allowed_by_environment" }

  return {
    environment,
    backendAllowed,
    backendReason,
    executionModeCeiling,
    liveReason,
    workerEnabled: backendAllowed && env.SOCIAL_WORKER_ENABLED === "true",
  }
}

export function currentSocialRuntime(): SocialRuntime {
  return resolveSocialRuntime({
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_PREVIEW_READ_ONLY: process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY,
    SOCIAL_AGENT_OS_ENABLED: process.env.SOCIAL_AGENT_OS_ENABLED,
    SOCIAL_QA_DATABASE_REF: process.env.SOCIAL_QA_DATABASE_REF,
    SOCIAL_EXECUTION_MODE: process.env.SOCIAL_EXECUTION_MODE,
    SOCIAL_LIVE_PUBLISHING_ENABLED: process.env.SOCIAL_LIVE_PUBLISHING_ENABLED,
    SOCIAL_WORKER_ENABLED: process.env.SOCIAL_WORKER_ENABLED,
  })
}

/** Effective mode = the stricter of environment ceiling and DB control. */
export function effectiveExecutionMode(runtime: SocialRuntime, controlMode: ExecutionMode): ExecutionMode {
  return runtime.executionModeCeiling === "live" && controlMode === "live" ? "live" : "dry_run"
}
