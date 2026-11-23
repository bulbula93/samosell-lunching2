// @vitest-environment node
/** Daily Meta results sync: parsing, Instagram/Facebook reads, follower gating, errors, attribution. */
import { describe, expect, it, vi } from "vitest"
import { PublishError } from "@/lib/social/adapters/meta"
import { aggregateSlotVisits, readActiveHours, readInsightValues, slotPerformance, syncInsights, tbilisiDate, type GraphCaller } from "@/lib/social/insights"
import { resolveSocialRuntime } from "@/lib/social/runtime"
import { isMetaId, MemorySocialStore } from "@/lib/social/store"
import type { PublishJob, SocialPost } from "@/lib/social/types"

const prod = resolveSocialRuntime({ VERCEL_ENV: "production", SOCIAL_AGENT_OS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co", SOCIAL_EXECUTION_MODE: "live", SOCIAL_LIVE_PUBLISHING_ENABLED: "true" })
const NOW = Date.parse("2026-11-24T08:00:00Z")

function seed(store: MemorySocialStore, id: string, contentType: SocialPost["contentType"], when: string, jobs: Array<Partial<PublishJob> & { platform: PublishJob["platform"] }>) {
  store.posts.set(id, { id, idempotencyKey: `plan:2026-11-23:0:featured_listing${contentType === "story" ? ":story" : ""}:${id}`, status: "published", pillar: "featured_listing", contentType, caption: "x".repeat(30), hashtags: [], mediaUrls: [], linkUrl: null, listingId: null, platforms: ["instagram", "facebook"], scheduledFor: when, version: 1, qualityPassed: true, qualityReport: null, createdByType: "agent", createdBy: "creative", createdAt: when, updatedAt: when })
  for (const j of jobs) {
    const jobId = `${id}-${j.platform}`
    store.jobs.set(jobId, { id: jobId, postId: id, postVersion: 1, executionMode: "live", idempotencyKey: jobId, status: "published", attempt: 1, maxAttempts: 3, leaseToken: null, leasedUntil: null, scheduledAt: when, externalContainerId: null, externalPostId: null, lastErrorCode: null, ...j })
  }
}

function fakes(opts: { igFollowers?: number; igError?: Error; fbError?: Error } = {}) {
  const ig = vi.fn<GraphCaller["call"]>(async (_m, path, params) => {
    if (opts.igError && path.endsWith("/insights") && params.metric !== "online_followers") throw opts.igError
    if (path === "17841400000000001") return { followers_count: opts.igFollowers ?? 21 }
    if (path.endsWith("/insights") && params.metric === "online_followers") return { data: [{ name: "online_followers", period: "lifetime", values: [{ value: { "15": 40, "21": 55, "22": 50, "x": 9 } }] }] }
    return { data: [{ name: "reach", values: [{ value: 120 }] }, { name: "likes", total_value: { value: 7 } }, { name: "saved", values: [{ value: 3 }] }, { name: "views", values: [{ value: 300 }] }] }
  })
  const fb = vi.fn<GraphCaller["call"]>(async (_m, path) => {
    if (opts.fbError) throw opts.fbError
    if (path === "1326431663889577") return { followers_count: 15 }
    if (path.includes("_")) return { reactions: { summary: { total_count: 4 } }, comments: { summary: { total_count: 1 } }, shares: { count: 2 } }
    return { likes: { summary: { total_count: 5 } }, comments: { summary: { total_count: 0 } } }
  })
  return { ig, fb, clients: { instagram: { call: ig }, facebook: { call: fb } } }
}
const creds = { version: "v26.0", pageId: "1326431663889577", pageToken: "p", igUserId: "17841400000000001", igToken: "i", igHost: "graph.facebook.com" as const }

describe("parsers", () => {
  it("reads values[0].value and total_value.value", () => {
    expect(readInsightValues({ data: [{ name: "reach", values: [{ value: 10 }] }, { name: "likes", total_value: { value: 3 } }, { name: "bad", values: [{ value: -1 }] }] })).toEqual({ reach: 10, likes: 3, bad: 0 })
  })
  it("reads online_followers hours 0..23 only; empty → null", () => {
    expect(readActiveHours({ data: [{ name: "online_followers", values: [{ value: { "0": 1, "23": 2, "24": 9, "a": 3 } }] }] })).toEqual({ "0": 1, "23": 2 })
    expect(readActiveHours({ data: [] })).toBeNull()
  })
  it("tbilisiDate uses UTC+4", () => {
    expect(tbilisiDate("2026-11-23T21:30:00Z")).toBe("2026-11-24")
  })
  it("only real Meta ids are synced", () => {
    expect(isMetaId("17901234567890123")).toBe(true)
    expect(isMetaId("1326431663889577_122110000000000")).toBe(true)
    for (const bad of ["ig_container:1790", "manual_confirmed:2026-11-23", "dryrun_ig_abc", "1_2"]) expect(isMetaId(bad)).toBe(false)
  })
})

describe("syncInsights", () => {
  it("stores one row per post/platform with lifetime totals; Facebook photo vs feed post fields", async () => {
    const store = new MemorySocialStore(undefined, { killSwitch: false, executionMode: "live" })
    seed(store, "p1", "single_image", "2026-11-23T17:00:00Z", [{ platform: "instagram", externalPostId: "17901234567890123" }, { platform: "facebook", externalPostId: "122110000000001" }])
    seed(store, "p2", "carousel", "2026-11-21T08:00:00Z", [{ platform: "instagram", externalPostId: "ig_container:181" }, { platform: "facebook", externalPostId: "1326431663889577_122110000000002" }])
    const f = fakes()
    const r = await syncInsights({ store, runtime: prod, credentials: creds, clients: f.clients, now: () => NOW })
    expect(r).toMatchObject({ state: "ran", posts: 3, updated: 3, failed: 0 })
    expect(store.metrics.find(m => m.postId === "p1" && m.platform === "instagram")).toMatchObject({ metricDate: "2026-11-23", reach: 120, likes: 7, saves: 3, impressions: 300 })
    expect(store.metrics.find(m => m.postId === "p1" && m.platform === "facebook")).toMatchObject({ likes: 5, comments: 0, shares: 0 })
    expect(store.metrics.find(m => m.postId === "p2" && m.platform === "facebook")).toMatchObject({ likes: 4, comments: 1, shares: 2, metricDate: "2026-11-21" })
    expect(f.ig.mock.calls.every(c => c[0] === "GET") && f.fb.mock.calls.every(c => c[0] === "GET")).toBe(true)
    // Re-running replaces, never duplicates.
    await syncInsights({ store, runtime: prod, credentials: creds, clients: f.clients, now: () => NOW })
    expect(store.metrics).toHaveLength(3)
  })
  it("Stories ask only for metrics Stories support", async () => {
    const store = new MemorySocialStore(undefined, { killSwitch: false, executionMode: "live" })
    seed(store, "s1", "story", "2026-11-23T18:00:00Z", [{ platform: "instagram", externalPostId: "17901234567890999" }])
    const f = fakes()
    await syncInsights({ store, runtime: prod, credentials: creds, clients: f.clients, now: () => NOW })
    expect(f.ig.mock.calls.find(c => c[1] === "17901234567890999/insights")![2]).toEqual({ metric: "reach,views,shares" })
  })
  it("below 100 followers it does not ask for active hours; from 100 it stores them", async () => {
    const small = new MemorySocialStore(undefined, { killSwitch: false, executionMode: "live" })
    const f1 = fakes({ igFollowers: 21 })
    await syncInsights({ store: small, runtime: prod, credentials: creds, clients: f1.clients, now: () => NOW })
    expect(f1.ig.mock.calls.some(c => c[2].metric === "online_followers")).toBe(false)
    expect(small.accountStats).toEqual(expect.arrayContaining([expect.objectContaining({ platform: "instagram", followers: 21, activeHours: null }), expect.objectContaining({ platform: "facebook", followers: 15 })]))
    const big = new MemorySocialStore(undefined, { killSwitch: false, executionMode: "live" })
    await syncInsights({ store: big, runtime: prod, credentials: creds, clients: fakes({ igFollowers: 140 }).clients, now: () => NOW })
    expect(big.accountStats.find(a => a.platform === "instagram")!.activeHours).toEqual({ "15": 40, "21": 55, "22": 50 })
  })
  it("a missing permission is recorded per platform and audited; other platform still syncs", async () => {
    const store = new MemorySocialStore(undefined, { killSwitch: false, executionMode: "live" })
    seed(store, "p1", "single_image", "2026-11-23T17:00:00Z", [{ platform: "instagram", externalPostId: "17901234567890123" }, { platform: "facebook", externalPostId: "122110000000001" }])
    const r = await syncInsights({ store, runtime: prod, credentials: creds, clients: fakes({ igError: new PublishError("meta_permission_denied", false) }).clients, now: () => NOW })
    expect(r).toMatchObject({ updated: 1, failed: 1, firstError: "meta_permission_denied" })
    expect(store.accountStats.find(a => a.platform === "instagram")!.errorCode).toBe("meta_permission_denied")
    expect(store.accountStats.find(a => a.platform === "facebook")!.errorCode).toBeNull()
    expect(store.audit.at(-1)).toMatchObject({ action: "sync_metrics", reason: "metrics_synced_with_errors" })
  })
  it("kill switch and missing credentials stop it before any Meta call", async () => {
    const f = fakes()
    const stopped = new MemorySocialStore()
    expect((await syncInsights({ store: stopped, runtime: prod, credentials: creds, clients: f.clients })).state).toBe("stopped")
    expect(f.ig).not.toHaveBeenCalled()
    const open = new MemorySocialStore(undefined, { killSwitch: false })
    expect(await syncInsights({ store: open, runtime: prod, credentials: null })).toMatchObject({ state: "stopped", firstError: "meta_credentials_missing" })
  })
  it("stops reading posts at the deadline", async () => {
    const store = new MemorySocialStore(undefined, { killSwitch: false, executionMode: "live" })
    for (let i = 0; i < 5; i++) seed(store, `p${i}`, "single_image", `2026-11-2${i}T17:00:00Z`, [{ platform: "instagram", externalPostId: `1790123456789000${i}` }])
    let t = NOW
    const r = await syncInsights({ store, runtime: prod, credentials: creds, clients: fakes().clients, now: () => (t += 15_000), deadlineMs: 40_000 })
    expect(r.updated).toBeLessThan(5)
  })
})

describe("attribution", () => {
  it("groups tagged visits by utm_content; chats counted separately", () => {
    const v = aggregateSlotVisits([
      { event_name: "page_view", anonymous_id: "a", last_touch: { utm_campaign: "agent_os", utm_content: "plan_2026_11_23_0_featured_listing" } },
      { event_name: "page_view", anonymous_id: "a", last_touch: { utm_campaign: "agent_os", utm_content: "plan_2026_11_23_0_featured_listing" } },
      { event_name: "page_view", anonymous_id: "b", last_touch: { utm_campaign: "agent_os", utm_content: "plan_2026_11_23_0_featured_listing" } },
      { event_name: "buyer_contact_started", user_id: "u", last_touch: { utm_campaign: "agent_os", utm_content: "plan_2026_11_23_0_featured_listing" } },
      { event_name: "page_view", anonymous_id: "c", last_touch: { utm_campaign: "agent_os" } },
    ])
    expect(v).toEqual([
      { utmContent: "plan_2026_11_23_0_featured_listing", visitors: 2, pageViews: 3, contacts: 1 },
      { utmContent: "untagged", visitors: 1, pageViews: 1, contacts: 0 },
    ])
  })
  it("slotPerformance groups by Tbilisi weekday and time", () => {
    const rows = slotPerformance(
      [{ postId: "p1", platform: "instagram", metricDate: "2026-11-23", impressions: 0, reach: 100, likes: 3, comments: 1, shares: 0, saves: 1, linkClicks: 0 }],
      [{ id: "p1", scheduledFor: "2026-11-23T17:00:00Z", utm: "u1" }, { id: "p2", scheduledFor: "2026-11-27T11:00:00Z", utm: "u2" }],
      [{ utmContent: "u2", visitors: 4, pageViews: 6, contacts: 1 }],
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ posts: 1, visitors: 4, contacts: 1, reach: 0 })
    expect(rows[1]).toMatchObject({ posts: 1, reach: 100, engagements: 5 })
    expect(rows[1].slot).toMatch(/21:00/)
  })
})
