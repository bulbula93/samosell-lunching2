import { describe, expect, it } from "vitest"
import { authorizeAgentAction } from "./policy"

describe("AI Operations policy", () => {
  it("denies all actions while disabled", () => {
    expect(authorizeAgentAction({ role: "finance", action: "read_metrics", environment: "preview", enabled: false }).allowed).toBe(false)
  })
  it("blocks actions outside the agent role", () => {
    expect(authorizeAgentAction({ role: "seo", action: "refund_payment", environment: "production", enabled: true, approvedByHuman: true }).allowed).toBe(false)
  })
  it("allows only read and draft in preview", () => {
    expect(authorizeAgentAction({ role: "support", action: "draft_reply", environment: "preview", enabled: true }).allowed).toBe(true)
    expect(authorizeAgentAction({ role: "support", action: "publish_reply", environment: "preview", enabled: true, guardedPolicyPassed: true }).allowed).toBe(false)
    expect(authorizeAgentAction({ role: "finance", action: "refund_payment", environment: "preview", enabled: true, approvedByHuman: true }).allowed).toBe(false)
  })
  it("requires approval for sensitive production actions", () => {
    const args = { role: "technical" as const, action: "deploy_production" as const, environment: "production" as const, enabled: true }
    expect(authorizeAgentAction(args)).toMatchObject({ allowed: false, requiresApproval: true })
    expect(authorizeAgentAction({ ...args, approvedByHuman: true }).allowed).toBe(true)
  })
  it("requires guarded policy for low-risk writes", () => {
    const args = { role: "moderation" as const, action: "hide_listing" as const, environment: "production" as const, enabled: true }
    expect(authorizeAgentAction(args).allowed).toBe(false)
    expect(authorizeAgentAction({ ...args, guardedPolicyPassed: true }).allowed).toBe(true)
  })
})
