// @vitest-environment node
/** End-to-end workflow on the in-memory store: plan → QA → approval → queue → worker. */
import { describe, expect, it, vi } from "vitest"
import { PublishError, type PublishAdapter } from "@/lib/social/adapters/meta"
import { approveAndSchedule, draftAdForPost, enqueue, PolicyDeniedError, rejectPost, runPlanningCycle } from "@/lib/social/orchestrator"
import { resolveSocialRuntime } from "@/lib/social/runtime"
import { runSimulation, SIMULATION_LISTINGS } from "@/lib/social/simulation"
import { MemorySocialStore } from "@/lib/social/store"
import { runPublishTick } from "@/lib/social/worker"

const preview = resolveSocialRuntime({ VERCEL_ENV: "preview" })
const prodLive = resolveSocialRuntime({ VERCEL_ENV: "production", SOCIAL_AGENT_OS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co", SOCIAL_EXECUTION_MODE: "live", SOCIAL_LIVE_PUBLISHING_ENABLED: "true" })
const ADMIN = "11111111-1111-4111-8111-111111111111"

function setup(runtime = preview, control = {}) {
  let now = new Date("2026-11-06T10:00:00Z")
  const store = new MemorySocialStore(() => now, { killSwitch: false, ...control })
  const ctx = { store, runtime, now: () => now }
  return { store, ctx, advance: (iso: string) => { now = new Date(iso) }, clock: () => now.getTime() }
}

describe("planning cycle", () => {
  it("is blocked by the default kill switch", async () => {
    const store = new MemorySocialStore()
    await expect(runPlanningCycle({ store, runtime: preview }, { listings: SIMULATION_LISTINGS })).rejects.toThrow(PolicyDeniedError)
    expect(store.posts.size).toBe(0)
    expect(store.audit.at(-1)).toMatchObject({ decision: "deny", reason: "kill_switch_active" })
  })
  it("creates drafts, runs QA, requests approvals; re-running is idempotent", async () => {
    const { store, ctx } = setup()
    const a = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    expect(a.created).toBe(5)
    expect(a.passedQa).toBe(5)
    expect(a.approvalsRequested).toBe(5)
    const b = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    expect(b.created).toBe(0)
    expect(b.existing).toBe(5)
    expect(store.posts.size).toBe(5)
    expect(store.approvals).toHaveLength(5)
    expect(store.jobs.size).toBe(0) // nothing is queued without a human
  })
})

describe("approval → queue → dry-run worker", () => {
  it("publishes in dry-run only, exactly once per platform", async () => {
    const { store, ctx, advance, clock } = setup()
    const plan = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    const post = plan.posts[0]
    const r = await approveAndSchedule(ctx, post.id, post.version, ADMIN)
    expect(r.mode).toBe("dry_run")
    expect(r.jobs).toBe(post.platforms.length)

    // Duplicate enqueue attempts (double click, retry, second admin) cannot add jobs.
    await expect(approveAndSchedule(ctx, post.id, post.version, ADMIN)).rejects.toThrow()
    await expect(enqueue(ctx, (await store.getPost(post.id))!, "human_admin")).rejects.toThrow()
    expect([...store.jobs.values()].filter(j => j.postId === post.id)).toHaveLength(post.platforms.length)

    // Not due yet → nothing claimed.
    expect((await runPublishTick({ store, runtime: preview, now: clock })).claimed).toBe(0)
    advance("2026-11-09T15:01:00Z")
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const t1 = await runPublishTick({ store, runtime: preview, now: clock })
    expect(t1.completed).toBe(post.platforms.length)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
    expect([...store.jobs.values()].every(j => j.status === "dry_run_completed" && j.externalPostId?.startsWith("dryrun_"))).toBe(true)
    expect((await store.getPost(post.id))!.status).toBe("published")
    // A second tick finds nothing: no duplicate publishing.
    expect((await runPublishTick({ store, runtime: preview, now: clock })).claimed).toBe(0)
  })

  it("editing after approval invalidates the approval", async () => {
    const { store, ctx } = setup()
    const plan = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    const post = plan.posts[1]
    await store.updatePostContent(post.id, { caption: post.caption + "\nახალი ხაზი" })
    const edited = (await store.getPost(post.id))!
    expect(edited.version).toBe(2)
    expect(edited.status).toBe("draft")
    await expect(approveAndSchedule(ctx, post.id, 1, ADMIN)).rejects.toThrow("stale_version")
    await expect(approveAndSchedule(ctx, post.id, 2, ADMIN)).rejects.toThrow("quality_not_passed") // edit reset QA
  })

  it("rejected posts are never queued", async () => {
    const { store, ctx } = setup()
    const plan = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    const p = await rejectPost(ctx, plan.posts[2].id, 1, ADMIN)
    expect(p.status).toBe("rejected")
    await expect(enqueue(ctx, p, "human_admin")).rejects.toThrow()
    expect(store.jobs.size).toBe(0)
  })

  it("kill switch engaged after queueing stops the worker", async () => {
    const { store, ctx, advance, clock } = setup()
    const plan = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    await approveAndSchedule(ctx, plan.posts[0].id, 1, ADMIN)
    await store.updateControl({ killSwitch: true })
    advance("2026-11-09T15:01:00Z")
    expect((await runPublishTick({ store, runtime: preview, now: clock })).state).toBe("stopped")
    expect([...store.jobs.values()].every(j => j.status === "queued")).toBe(true)
  })
})

describe("live-mode publishing safety (mocked adapters, production runtime)", () => {
  async function liveSetup(adapter: (platform: "instagram" | "facebook") => PublishAdapter) {
    const s = setup(prodLive, { executionMode: "live" })
    const plan = await runPlanningCycle(s.ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    const post = plan.posts[0]
    const r = await approveAndSchedule(s.ctx, post.id, 1, ADMIN)
    expect(r.mode).toBe("live")
    s.advance("2026-11-09T15:01:00Z")
    const tick = () => runPublishTick({ store: s.store, runtime: prodLive, now: s.clock, adapterFactory: p => adapter(p) })
    return { ...s, post, tick }
  }
  it("unknown outcome goes to needs_review and is never retried", async () => {
    const publish = vi.fn(async () => { throw new PublishError("unknown_outcome", false) })
    const { store, tick, advance } = await liveSetup(platform => ({ platform, mode: "live", publish }))
    await tick()
    advance("2026-11-10T15:01:00Z")
    await tick()
    expect(publish).toHaveBeenCalledTimes(store.jobs.size) // once per job, no second attempt
    expect([...store.jobs.values()].every(j => j.status === "needs_review")).toBe(true)
  })
  it("retryable errors back off, then dead-letter after max attempts", async () => {
    const publish = vi.fn(async () => { throw new PublishError("meta_api_unavailable", true) })
    const { store, tick, advance } = await liveSetup(platform => ({ platform, mode: "live", publish }))
    for (const at of ["2026-11-09T15:01:00Z", "2026-11-09T15:03:00Z", "2026-11-09T15:10:00Z", "2026-11-09T16:00:00Z"]) { advance(at); await tick() }
    expect([...store.jobs.values()].every(j => j.status === "dead_letter" && j.attempt === 3)).toBe(true)
  })
  it("an instagram retry resumes the recorded container (no second container)", async () => {
    let attempt = 0
    const containers: string[] = []
    const { store, tick, advance } = await liveSetup(platform => ({
      platform, mode: "live",
      publish: async (input, hooks) => {
        if (platform === "facebook") return { externalPostId: "fb_1" }
        attempt++
        if (!input.existingContainerId) { await hooks.recordContainer("c_1"); containers.push("c_1") }
        if (attempt === 1) throw new PublishError("meta_media_not_ready", true)
        return { externalPostId: "ig_1", containerId: input.existingContainerId ?? "c_1" }
      },
    }))
    await tick()
    advance("2026-11-09T15:03:00Z")
    await tick()
    const ig = [...store.jobs.values()].find(j => j.platform === "instagram")
    expect(ig).toBeDefined()
    expect(containers).toEqual(["c_1"])
    expect(ig).toMatchObject({ status: "published", externalPostId: "ig_1", externalContainerId: "c_1" })
  })
  it("a live job in a runtime that lost live permission is not sent", async () => {
    const publish = vi.fn(async () => ({ externalPostId: "x" }))
    const { store, advance } = await liveSetup(platform => ({ platform, mode: "live", publish }))
    advance("2026-11-09T15:01:00Z")
    await runPublishTick({ store, runtime: preview, adapterFactory: p => ({ platform: p, mode: "live", publish }) })
    expect(publish).not.toHaveBeenCalled()
  })
})

describe("ads planner and simulation", () => {
  it("ad drafts are zero-budget drafts only", async () => {
    const { store, ctx } = setup()
    const plan = await runPlanningCycle(ctx, { weekStart: "2026-11-09", listings: SIMULATION_LISTINGS })
    const d = await draftAdForPost(ctx, plan.posts[0].id)
    expect(d).toMatchObject({ dailyBudgetUsd: 0, status: "draft" })
    await expect(store.insertAdDraft({ ...d, idempotencyKey: "x", dailyBudgetUsd: 5 as 0 })).rejects.toThrow("ads_budget_must_be_zero")
  })
  it("preview simulation runs the full pipeline with zero network calls", async () => {
    const spy = vi.spyOn(globalThis, "fetch")
    const sim = await runSimulation(new Date("2026-11-06T10:00:00Z"))
    expect(sim.plan.created).toBe(5)
    expect(sim.tick.completed).toBeGreaterThan(0)
    expect(sim.jobs.every(j => j.executionMode === "dry_run")).toBe(true)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
