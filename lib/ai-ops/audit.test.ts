import { describe, expect, it } from "vitest"
import { validateAuditEvent } from "./audit"
describe("audit event contract", () => {
  it("requires a digest instead of raw prompt data", () => {
    const event = { eventId:"a1",runId:"r1",jobId:"j1",role:"qa" as const,action:"draft_issue" as const,
      actorType:"agent" as const,decision:"success" as const,inputDigest:"sha256:"+"a".repeat(64),
      resourceType:"issue",resourceId:"123",occurredAt:"2026-10-17T10:00:00Z" }
    expect(validateAuditEvent(event)).toBe(true)
    expect(validateAuditEvent({ ...event, inputDigest:"hello@example.com" })).toBe(false)
  })
})
