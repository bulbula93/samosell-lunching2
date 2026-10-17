import { describe, expect, it } from "vitest"
import { claimJob, isLeaseExpired, normalizeJobKey, transitionJob, type AgentJob } from "./jobs"

const sample: AgentJob = {
  id: "j1", idempotencyKey: "support:ticket:100", role: "support", priority: "normal",
  status: "queued", attempt: 0, maxAttempts: 2, leasedUntil: null,
  createdAt: "2026-10-17T10:00:00Z", updatedAt: "2026-10-17T10:00:00Z",
}
describe("agent job lifecycle", () => {
  it("rejects malformed idempotency keys", () => {
    expect(normalizeJobKey("  support:ticket:100 ")).toBe("support:ticket:100")
    expect(() => normalizeJobKey("")).toThrow()
    expect(() => normalizeJobKey("a b")).toThrow()
  })
  it("claims a queued job with a bounded lease", () => {
    const job = claimJob(sample, "2026-10-17T10:01:00Z", "2026-10-17T10:02:00Z")
    expect(job).toMatchObject({ status: "leased", attempt: 1 })
    expect(isLeaseExpired(job, "2026-10-17T10:02:00Z")).toBe(true)
    expect(() => claimJob(job, "2026-10-17T10:01:00Z", "2026-10-17T10:03:00Z")).toThrow()
  })
  it("refuses invalid state transitions and exhausted retries", () => {
    expect(() => transitionJob(sample, "completed", "2026-10-17T10:01:00Z")).toThrow()
    const exhausted = { ...sample, status: "failed" as const, attempt: 2 }
    expect(() => transitionJob(exhausted, "queued", "2026-10-17T10:01:00Z")).toThrow()
    expect(transitionJob(exhausted, "dead_letter", "2026-10-17T10:01:00Z").status).toBe("dead_letter")
  })
  it("keeps approval jobs from becoming completed directly", () => {
    const review = { ...sample, status: "awaiting_approval" as const }
    expect(() => transitionJob(review, "completed", "2026-10-17T10:01:00Z")).toThrow()
  })
})
