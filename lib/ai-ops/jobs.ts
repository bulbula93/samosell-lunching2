/** Pure, deterministic job state machine. No scheduler, database or network side effects. */
import type { AgentRole } from "./policy"

export const JOB_STATUSES = ["queued", "leased", "awaiting_approval", "completed", "failed", "dead_letter", "cancelled"] as const
export type JobStatus = (typeof JOB_STATUSES)[number]
export type JobPriority = "low" | "normal" | "high" | "critical"
export type AgentJob = {
  id: string
  idempotencyKey: string
  role: AgentRole
  status: JobStatus
  priority: JobPriority
  attempt: number
  maxAttempts: number
  leasedUntil: string | null
  createdAt: string
  updatedAt: string
}
const transitions: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  queued: ["leased", "cancelled"],
  leased: ["queued", "awaiting_approval", "completed", "failed", "dead_letter"],
  awaiting_approval: ["queued", "cancelled"],
  completed: [],
  failed: ["queued", "dead_letter"],
  dead_letter: [],
  cancelled: [],
}
export function transitionJob(job: AgentJob, next: JobStatus, nowIso: string): AgentJob {
  if (!transitions[job.status].includes(next)) throw new Error("Invalid job state transition")
  if (!Number.isFinite(Date.parse(nowIso))) throw new Error("Invalid transition timestamp")
  if (next === "queued" && job.attempt >= job.maxAttempts) throw new Error("Retry limit reached")
  return { ...job, status: next, updatedAt: nowIso, leasedUntil: next === "leased" ? job.leasedUntil : null }
}
export function normalizeJobKey(value: string): string {
  const cleaned = value.trim()
  if (!cleaned || cleaned.length > 160 || !/^[a-zA-Z0-9:_./-]+$/.test(cleaned)) {
    throw new Error("Invalid idempotency key")
  }
  return cleaned
}
export function isLeaseExpired(job: AgentJob, nowIso: string): boolean {
  if (job.status !== "leased" || !job.leasedUntil) return false
  const expiry = Date.parse(job.leasedUntil), now = Date.parse(nowIso)
  return Number.isFinite(expiry) && Number.isFinite(now) && expiry <= now
}
/** Caller must claim the job atomically in a database transaction before running it. */
export function claimJob(job: AgentJob, nowIso: string, leaseUntilIso: string): AgentJob {
  if (job.status !== "queued") throw new Error("Job not queued")
  if (job.attempt >= job.maxAttempts) throw new Error("Retry limit reached")
  if (Date.parse(leaseUntilIso) <= Date.parse(nowIso) || !Number.isFinite(Date.parse(nowIso))) throw new Error("Invalid lease")
  return { ...transitionJob(job, "leased", nowIso), attempt: job.attempt + 1, leasedUntil: leaseUntilIso }
}
