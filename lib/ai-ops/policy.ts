/**
 * SamoSell AI Operations policy — deny by default.
 * This module is deliberately side-effect-free. Never treat a model output as authorization.
 */
export const AGENT_ROLES = [
  "coordinator", "support", "moderation", "technical", "marketing",
  "seo", "finance", "seller_success", "qa",
] as const
export type AgentRole = (typeof AGENT_ROLES)[number]

export const ACTIONS = {
  read_metrics: "read",
  read_redacted_ticket: "read",
  analyze_report: "read",
  draft_reply: "draft",
  draft_issue: "draft",
  draft_campaign: "draft",
  publish_reply: "guarded",
  hide_listing: "guarded",
  suspend_account: "approval",
  refund_payment: "approval",
  change_ad_budget: "approval",
  merge_to_main: "approval",
  deploy_production: "approval",
  change_production_schema: "approval",
  delete_user_data: "approval",
} as const
export type AgentAction = keyof typeof ACTIONS
export type Decision = { allowed: boolean; requiresApproval: boolean; reason: string }

const ALLOWED_ROLES: Record<AgentAction, readonly AgentRole[]> = {
  read_metrics: AGENT_ROLES,
  read_redacted_ticket: ["coordinator", "support", "moderation"],
  analyze_report: ["coordinator", "moderation", "technical"],
  draft_reply: ["support"],
  draft_issue: ["technical", "qa"],
  draft_campaign: ["marketing"],
  publish_reply: ["support"],
  hide_listing: ["moderation"],
  suspend_account: ["moderation"],
  refund_payment: ["finance"],
  change_ad_budget: ["marketing", "finance"],
  merge_to_main: ["technical", "qa"],
  deploy_production: ["technical"],
  change_production_schema: ["technical"],
  delete_user_data: ["coordinator"],
}

/** Preview starts read-only: no action that alters user, financial or production state. */
export function authorizeAgentAction(input: {
  role: AgentRole
  action: AgentAction
  environment: "preview" | "production"
  enabled: boolean
  approvedByHuman?: boolean
  guardedPolicyPassed?: boolean
}): Decision {
  if (!input.enabled) return { allowed: false, requiresApproval: false, reason: "Agents disabled" }
  if (!ALLOWED_ROLES[input.action].includes(input.role)) {
    return { allowed: false, requiresApproval: false, reason: "Role not authorized" }
  }
  const tier = ACTIONS[input.action]
  if (tier === "read" || tier === "draft") {
    return { allowed: true, requiresApproval: false, reason: "Read-only or draft action" }
  }
  if (input.environment === "preview") {
    return { allowed: false, requiresApproval: tier === "approval", reason: "Preview write actions are disabled" }
  }
  if (tier === "approval") {
    return input.approvedByHuman
      ? { allowed: true, requiresApproval: false, reason: "Human approval supplied; execution still requires server-side verification" }
      : { allowed: false, requiresApproval: true, reason: "Human approval required" }
  }
  return input.guardedPolicyPassed === true
    ? { allowed: true, requiresApproval: false, reason: "Guarded policy passed" }
    : { allowed: false, requiresApproval: false, reason: "Guarded policy not satisfied" }
}
