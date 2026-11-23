// @vitest-environment node
/**
 * Weekly planning targets (this week / next week), the admin overview, Story QA, and the
 * automatic resolution of Instagram jobs stuck in needs_review.
 */
import { describe, expect, it, vi } from "vitest"
import type { PublishAdapter } from "@/lib/social/adapters/meta"
import { buildWeeklyPlan, weekSlotTimes } from "@/lib/social/agents/strategy"
import { checkQuality } from "@/lib/social/agents/quality"
import { approveAndSchedule, planWindow, runPlanningCycle, summarizeWeeks } from "@/lib/social/orchestrator"
import { resolveSocialRuntime } from "@/lib/social/runtime"
import { SIMULATION_LISTINGS } from "@/lib/social/simulation"
import { MemorySocialStore } from "@/lib/social/store"
import { runPublishTick, STALE_REVIEW_MS } from "@/lib/social/worker"
import type { CandidateListing } from "@/lib/social/types"

const preview = resolveSocialRuntime({ VERCEL_ENV: "preview" })
const prodLive = resolveSocialRuntime({ VERCEL_ENV: "production", SOCIAL_AGENT_OS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co", SOCIAL_EXECUTION_MODE: "live", SOCIAL_LIVE_PUBLISHING_ENABLED: "true" })
const ADMIN = "11111111-1111-4111-8111-111111111111"

function setup(start: string, runtime = preview, control = {}) {
  let now = new Date(start)
  const store = new MemorySocialStore(() => now, { killSwitch: false, ...control })
  return { store, ctx: { store, runtime, now: () => now }, advance: (iso: string) => { now = new Date(iso) }, clock: () => now.getTime() }
}

describe("plan window follows Tbilisi weeks", () => {
  it("Monday 14:00 Tbilisi → this week starts today, next week a week later", () => {
    const now = new Date("2026-11-23T10:00:00Z") // Mon 14:00 Tbilisi
    expect(planWindow("current", now)).toEqual({ weekStart: "2026-11-23", notBefore: "2026-11-23T12:00:00.000Z" })
    expect(planWindow("next", now).weekStart).toBe("2026-11-30")
  })
  it("Monday 02:00 Tbilisi (still Sunday in UTC) already counts as the new week", () => {
    expect(planWindow("current", new Date("2026-11-22T22:00:00Z")).weekStart).toBe("2026-11-23")
  })
})

describe("strategy: notBefore and recently featured items", () => {
  const listings: CandidateListing[] = SIMULATION_LISTINGS
  it("skips slots that are already past (current-week planning)", () => {
    const slots = buildWeeklyPlan({ weekStart: "2026-11-23", listings, platforms: ["facebook"], notBefore: "2026-11-24T00:00:00Z" })
    expect(slots.map(s => s.slotKey)).toEqual(["plan:2026-11-23:2:how_to_sell", "plan:2026-11-23:4:giveaway", "plan:2026-11-23:5:category_roundup", "plan:2026-11-23:6:trust"])
    expect(slots.every(s => Date.parse(s.scheduledFor) >= Date.parse("2026-11-24T00:00:00Z"))).toBe(true)
  })
  it("prefers items not featured recently, but falls back instead of skipping a slot", () => {
    const first = buildWeeklyPlan({ weekStart: "2026-11-23", listings, platforms: ["facebook"] })[0]
    const fresh = buildWeeklyPlan({ weekStart: "2026-11-23", listings, platforms: ["facebook"], excludeListingIds: [first.listing!.id] })[0]
    expect(fresh.listing!.id).not.toBe(first.listing!.id)
    const all = listings.map(l => l.id)
    const fallback = buildWeeklyPlan({ weekStart: "2026-11-23", listings, platforms: ["facebook"], excludeListingIds: all })[0]
    expect(fallback.pillar).toBe("featured_listing")
    expect(fallback.listing).not.toBeNull()
  })
  it("weekSlotTimes lists the five evening slots in UTC", () => {
    expect(weekSlotTimes("2026-11-23")).toEqual(["2026-11-23T15:00:00.000Z", "2026-11-25T15:00:00.000Z", "2026-11-27T14:00:00.000Z", "2026-11-28T08:00:00.000Z", "2026-11-29T16:00:00.000Z"])
  })
})

describe("planning targets and overview", () => {
  it("fills only the rest of the current week, then reports it as planned; next week stays separate", async () => {
    const { store, ctx } = setup("2026-11-23T10:00:00Z") // Mon 14:00 Tbilisi, Monday slot (19:00) still ahead
    expect(summarizeWeeks([], new Date("2026-11-23T10:00:00Z")).map(w => [w.target, w.feedPosts, w.openSlots])).toEqual([["current", 0, 5], ["next", 0, 5]])
    const current = await runPlanningCycle(ctx, { target: "current", listings: SIMULATION_LISTINGS })
    expect(current.weekStart).toBe("2026-11-23")
    expect(current.created).toBe(5)
    const posts = await store.listPosts("2026-11-20", "2026-12-10", 100)
    const [thisWeek, nextWeek] = summarizeWeeks(posts, new Date("2026-11-23T10:00:00Z"))
    expect(thisWeek).toMatchObject({ feedPosts: 5, awaitingApproval: 5, openSlots: 0 })
    expect(nextWeek).toMatchObject({ weekStart: "2026-11-30", feedPosts: 0, openSlots: 5 })
    const again = await runPlanningCycle(ctx, { target: "current", listings: SIMULATION_LISTINGS })
    expect(again.created).toBe(0)
  })
  it("late in the week only future slots (with 2 h lead time) are created", async () => {
    const { ctx } = setup("2026-11-28T06:30:00Z") // Sat 10:30 Tbilisi; Saturday 12:00 slot is < 2 h away
    const r = await runPlanningCycle(ctx, { target: "current", listings: SIMULATION_LISTINGS })
    expect(r.created).toBe(1)
    expect(r.posts.filter(p => p.contentType !== "story").map(p => p.idempotencyKey)).toEqual(["plan:2026-11-23:6:trust"])
  })
  it("next week avoids items already featured this week", async () => {
    const { store, ctx } = setup("2026-11-23T10:00:00Z")
    await runPlanningCycle(ctx, { target: "current", listings: SIMULATION_LISTINGS })
    await runPlanningCycle(ctx, { target: "next", listings: SIMULATION_LISTINGS })
    const posts = await store.listPosts("2026-11-20", "2026-12-10", 100)
    const thisWeek = new Set(posts.filter(p => p.idempotencyKey.startsWith("plan:2026-11-23:") && p.listingId).map(p => p.listingId))
    const next = posts.filter(p => p.idempotencyKey.startsWith("plan:2026-11-30:") && p.listingId && p.contentType !== "story")
    expect(next.length).toBeGreaterThan(0)
    expect(next.some(p => !thisWeek.has(p.listingId))).toBe(true)
  })
})

describe("Story QA", () => {
  const base = { hashtags: [], mediaUrls: ["https://samosell.ge/s.jpg"], linkUrl: "https://samosell.ge/listing/x", platforms: ["instagram", "facebook"] as const, scheduledFor: "2026-12-01T15:00:00Z" }
  it("a Story's internal label is not judged as a caption", () => {
    const r = checkQuality({ ...base, platforms: [...base.platforms], caption: "Story · Zara dress", contentType: "story" }, new Date("2026-11-23T10:00:00Z"))
    expect(r.passed).toBe(true)
    expect(r.issues.map(i => i.code)).not.toContain("caption_too_short")
    expect(r.issues.map(i => i.code)).not.toContain("not_georgian")
  })
  it("Story media rules still apply; feed posts keep caption rules", () => {
    const now = new Date("2026-11-23T10:00:00Z")
    expect(checkQuality({ ...base, platforms: [...base.platforms], mediaUrls: ["https://samosell.ge/s.webp"], caption: "Story · x", contentType: "story" }, now).passed).toBe(false)
    expect(checkQuality({ ...base, platforms: [...base.platforms], caption: "short", contentType: "single_image" }, now).issues.map(i => i.code)).toContain("caption_too_short")
  })
})

describe("needs_review auto-resolution for Instagram", () => {
  async function stuck(opts: { container: string | null; ageMs?: number; platform?: "instagram" | "facebook"; error?: string }) {
    const s = setup("2026-11-09T10:00:00Z", prodLive, { executionMode: "live" })
    const plan = await runPlanningCycle(s.ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    await approveAndSchedule(s.ctx, plan.posts[0].id, 1, ADMIN)
    const job = [...s.store.jobs.values()].find(j => j.platform === (opts.platform ?? "facebook"))!
    Object.assign(job, { status: "needs_review", lastErrorCode: opts.error ?? "lease_expired", attempt: 3, externalContainerId: opts.container })
    for (const other of s.store.jobs.values()) if (other.id !== job.id) Object.assign(other, { status: "published", externalPostId: "1_2" })
    s.advance(new Date(Date.parse(job.scheduledAt) + (opts.ageMs ?? 3600_000)).toISOString())
    return { ...s, job }
  }
  function adapter(status: string | Error, publish = vi.fn<(input: { existingContainerId: string | null }) => Promise<{ externalPostId: string }>>(async () => ({ externalPostId: "17999" }))) {
    const containerStatus = vi.fn(async () => { if (status instanceof Error) throw status; return status })
    const make = (platform: "instagram" | "facebook"): PublishAdapter => ({ platform, mode: "live", publish, containerStatus })
    return { make, publish, containerStatus }
  }
  const igStuck = (opts: Parameters<typeof stuck>[0]) => stuck({ ...opts, platform: "instagram" })

  it("PUBLISHED container → marked published, nothing is sent again", async () => {
    const { store, job, clock } = await igStuck({ container: "17900000000000001" })
    const a = adapter("PUBLISHED")
    const r = await runPublishTick({ store, runtime: prodLive, now: clock, adapterFactory: a.make })
    expect(r.reconciled).toBe(1)
    expect(a.publish).not.toHaveBeenCalled()
    expect(store.jobs.get(job.id)).toMatchObject({ status: "published", externalPostId: "ig_container:17900000000000001" })
    expect((await store.getPost(job.postId))!.status).toBe("published")
  })
  it("FINISHED container (recent) → resumed on the same container in the same tick", async () => {
    const { store, job, clock } = await igStuck({ container: "17900000000000002" })
    const a = adapter("FINISHED")
    await runPublishTick({ store, runtime: prodLive, now: clock, adapterFactory: a.make })
    expect(a.publish).toHaveBeenCalledTimes(1)
    expect(a.publish.mock.calls[0][0]).toMatchObject({ existingContainerId: "17900000000000002" })
    expect(store.jobs.get(job.id)!.status).toBe("published")
  })
  it("expired lease without a container → resent fresh", async () => {
    const { store, clock } = await igStuck({ container: null })
    const a = adapter("FINISHED")
    await runPublishTick({ store, runtime: prodLive, now: clock, adapterFactory: a.make })
    expect(a.containerStatus).not.toHaveBeenCalled()
    expect(a.publish.mock.calls[0][0]).toMatchObject({ existingContainerId: null })
  })
  it("never went public and older than 48 h → cancelled instead of posting late", async () => {
    const { store, job, clock } = await igStuck({ container: "17900000000000003", ageMs: STALE_REVIEW_MS + 60_000 })
    const a = adapter("EXPIRED")
    await runPublishTick({ store, runtime: prodLive, now: clock, adapterFactory: a.make })
    expect(a.publish).not.toHaveBeenCalled()
    expect(store.jobs.get(job.id)!.status).toBe("cancelled")
    expect((await store.getPost(job.postId))!.status).toBe("published") // the Facebook copy went out
  })
  it("Meta unavailable → stays in needs_review; Facebook is never auto-resolved", async () => {
    const ig = await igStuck({ container: "17900000000000004" })
    await runPublishTick({ store: ig.store, runtime: prodLive, now: ig.clock, adapterFactory: adapter(new Error("down")).make })
    expect(ig.store.jobs.get(ig.job.id)!.status).toBe("needs_review")
    const fb = await stuck({ container: null, platform: "facebook" })
    const a = adapter("PUBLISHED")
    await runPublishTick({ store: fb.store, runtime: prodLive, now: fb.clock, adapterFactory: a.make })
    expect(fb.store.jobs.get(fb.job.id)!.status).toBe("needs_review")
    expect(a.containerStatus).not.toHaveBeenCalled()
  })
  it("unknown outcome without a recorded container is left for a human", async () => {
    const { store, job, clock } = await igStuck({ container: null, error: "unknown_outcome" })
    await runPublishTick({ store, runtime: prodLive, now: clock, adapterFactory: adapter("FINISHED").make })
    expect(store.jobs.get(job.id)!.status).toBe("needs_review")
  })
  it("kill switch stops reconciliation too", async () => {
    const { store, job, clock } = await igStuck({ container: "17900000000000005" })
    await store.updateControl({ killSwitch: true })
    const a = adapter("PUBLISHED")
    expect((await runPublishTick({ store, runtime: prodLive, now: clock, adapterFactory: a.make })).state).toBe("stopped")
    expect(a.containerStatus).not.toHaveBeenCalled()
    expect(store.jobs.get(job.id)!.status).toBe("needs_review")
  })
})
