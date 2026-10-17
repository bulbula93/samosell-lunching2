import type { AgentRole, AgentAction } from "./policy"

export type AgentAuditEvent = Readonly<{
  eventId: string
  runId: string
  jobId: string
  role: AgentRole
  action: AgentAction
  actorType: "agent" | "human" | "system"
  decision: "allow" | "deny" | "approval_requested" | "success" | "failure"
  inputDigest: string
  resourceType: string
  resourceId: string
  occurredAt: string
}>
/** Audit events must only include references and digests, never raw personal or payment data. */
export function validateAuditEvent(event: AgentAuditEvent): boolean {
  return Boolean(event.eventId && event.runId && event.jobId && event.resourceType &&
    event.resourceId && /^sha256:[a-f0-9]{64}$/.test(event.inputDigest) &&
    Number.isFinite(Date.parse(event.occurredAt)))
}
