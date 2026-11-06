// @vitest-environment node
import { describe, expect, it } from "vitest"
import { draftAdPlan } from "@/lib/social/agents/ads-planner"
import { summarizeMetrics } from "@/lib/social/agents/analytics"
import { draftCommunityReply } from "@/lib/social/agents/community"
import { createDraft, renderCaption } from "@/lib/social/agents/creative"
import { checkQuality } from "@/lib/social/agents/quality"
import { buildWeeklyPlan, mondayOf } from "@/lib/social/agents/strategy"
import { SIMULATION_LISTINGS } from "@/lib/social/simulation"

const both = ["instagram", "facebook"] as ("instagram" | "facebook")[]

describe("Strategy agent", () => {
  it("builds 5 Tbilisi-evening slots for a Monday week, deterministic", () => {
    const a = buildWeeklyPlan({ weekStart: "2026-11-09", listings: SIMULATION_LISTINGS, platforms: both })
    const b = buildWeeklyPlan({ weekStart: "2026-11-09", listings: SIMULATION_LISTINGS, platforms: both })
    expect(a).toEqual(b)
    expect(a).toHaveLength(5)
    expect(a[0].scheduledFor).toBe("2026-11-09T15:00:00.000Z") // 19:00 Tbilisi
    expect(new Set(a.map(s => s.slotKey)).size).toBe(5)
  })
  it("never invents a giveaway and never reuses a listing", () => {
    const noGifts = SIMULATION_LISTINGS.filter(l => !l.isGift)
    const plan = buildWeeklyPlan({ weekStart: "2026-11-09", listings: noGifts, platforms: both })
    expect(plan.some(s => s.pillar === "giveaway")).toBe(false)
    const ids = plan.flatMap(s => [s.listing?.id, ...s.listings.map(l => l.id)]).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it("falls back to evergreen posts with no listings, never the same one twice", () => {
    const plan = buildWeeklyPlan({ weekStart: "2026-11-09", listings: [], platforms: both })
    expect(plan.every(s => s.listing === null && ["trust", "how_to_sell"].includes(s.pillar))).toBe(true)
    expect(plan.map(s => s.pillar).sort()).toEqual(["how_to_sell", "trust"])
  })
  it("without gift listings the giveaway slot features another real item (no duplicate posts)", () => {
    const plan = buildWeeklyPlan({ weekStart: "2026-11-09", listings: SIMULATION_LISTINGS.filter(l => !l.isGift), platforms: both })
    const pillars = plan.map(s => s.pillar)
    expect(pillars.filter(p => p === "how_to_sell")).toHaveLength(1)
    expect(pillars.filter(p => p === "trust")).toHaveLength(1)
    expect(plan[2]).toMatchObject({ pillar: "featured_listing" })
    expect(plan[2].listing).not.toBeNull()
  })
  it("rejects non-Monday weeks; mondayOf works", () => {
    expect(() => buildWeeklyPlan({ weekStart: "2026-11-10", listings: [], platforms: both })).toThrow("week_must_start_monday")
    expect(mondayOf(new Date("2026-11-15T12:00:00Z"))).toBe("2026-11-09")
  })
})

describe("Creative + Quality agents", () => {
  const plan = buildWeeklyPlan({ weekStart: "2026-11-09", listings: SIMULATION_LISTINGS, platforms: both })
  const now = new Date("2026-11-06T10:00:00Z")
  it("every generated draft passes QA", () => {
    for (const slot of plan) {
      const d = createDraft(slot)
      const r = checkQuality(d, now)
      expect(r.issues.filter(i => i.severity === "error"), slot.pillar).toEqual([])
    }
  })
  it("drops Instagram automatically for non-JPEG media", () => {
    const d = createDraft({ ...plan[0], pillar: "featured_listing", listing: SIMULATION_LISTINGS[4] })
    expect(d.platforms).toEqual(["facebook"])
    expect(checkQuality({ ...d, platforms: ["instagram"] }, now).issues.map(i => i.code)).toContain("instagram_requires_jpeg")
  })
  it("uses the real /listing/<slug> URL with UTM tags", () => {
    const d = createDraft(plan[0])
    expect(d.linkUrl).toMatch(/^https:\/\/samosell\.ge\/listing\/sim-[a-z-]+\?utm_source=social/)
  })
  it("Instagram caption has no link; Facebook caption gets the link", () => {
    const d = createDraft(plan[0])
    expect(renderCaption(d, "instagram")).not.toContain("https://")
    expect(renderCaption(d, "facebook")).toContain(d.linkUrl!)
  })
  it("blocks personal data, false claims, foreign links, too many hashtags and bad media", () => {
    const base = createDraft(plan[1])
    const codes = (over: object) => checkQuality({ ...base, ...over }, now).issues.map(i => i.code)
    expect(codes({ caption: base.caption + "\nდამირეკე 599 12 34 56" })).toContain("personal_data")
    expect(codes({ caption: base.caption + "\n100% ორიგინალი" })).toContain("unverifiable_claim")
    expect(codes({ linkUrl: "https://evil.example/x" })).toContain("foreign_link")
    expect(codes({ hashtags: Array.from({ length: 31 }, (_, i) => `tag${i}`) })).toContain("too_many_hashtags")
    expect(codes({ mediaUrls: ["http://samosell.ge/x.jpg"] })).toContain("media_host")
    expect(codes({ platforms: ["tiktok"] })).toContain("tiktok_disabled")
    expect(checkQuality({ ...base, caption: "x".repeat(2300) }, now).passed).toBe(false)
  })
})

describe("brand media used for posts", () => {
  it("is a real, complete baseline JPEG (Instagram rejects anything else)", async () => {
    const { readFileSync } = await import("node:fs")
    const { BRAND_IMAGE_URL } = await import("@/lib/social/agents/creative")
    const bytes = readFileSync(`public${new URL(BRAND_IMAGE_URL).pathname}`)
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff])) // SOI
    expect(bytes.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]))          // EOI: not truncated
    expect(bytes.length).toBeGreaterThan(20_000)
  })
})

describe("Community, Analytics, Ads Planner", () => {
  it("never auto-replies to complaints or spam", () => {
    expect(draftCommunityReply("ეს თაღლითობაა, ვერ მივიღე")).toEqual({ intent: "complaint", escalate: true, reply: null })
    expect(draftCommunityReply("check https://spam.example").reply).toBeNull()
    expect(draftCommunityReply("რა ღირს?").intent).toBe("price_question")
  })
  it("summarizes engagement and best pillar", () => {
    const s = summarizeMetrics([
      { postId: "a", platform: "instagram", metricDate: "2026-11-10", impressions: 200, reach: 100, likes: 10, comments: 2, shares: 1, saves: 2, linkClicks: 3 },
      { postId: "b", platform: "facebook", metricDate: "2026-11-10", impressions: 100, reach: 100, likes: 1, comments: 0, shares: 0, saves: 0, linkClicks: 0 },
    ], { a: "giveaway", b: "trust" })
    expect(s.totalReach).toBe(200)
    expect(s.bestPillar).toBe("giveaway")
    expect(s.top[0].postId).toBe("a")
  })
  it("ad drafts always have a zero budget and draft status", () => {
    const d = draftAdPlan({ id: "p", pillar: "featured_listing", caption: "სათაური\nტექსტი" })
    expect(d.dailyBudgetUsd).toBe(0)
    expect(d.status).toBe("draft")
  })
})
