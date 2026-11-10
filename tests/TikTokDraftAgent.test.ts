// @vitest-environment node
import { describe, expect, it } from "vitest"
import {
  TIKTOK_DRAFT_POLICY, assertTikTokActionAllowed,
  buildTikTokDraftWeek, georgianWeekStart, isTikTokDraftEnvironment,
} from "@/lib/tiktok/draft-agent"
import type { CandidateListing } from "@/lib/social/types"
import { evaluateSocialAction } from "@/lib/social/policy-gateway"
import { resolveSocialRuntime } from "@/lib/social/runtime"

const listing: CandidateListing = {
  id: "real-123", slug: "shirt", title: "ლურჯი პერანგი",
  brand: "Brand", priceGel: 35, city: "თბილისი",
  category: "shirts", imageUrl: "https://samosell.ge/brand/samosell-social-brand.jpg", isGift: false,
}
const build = (listings: CandidateListing[] = [listing]) =>
  buildTikTokDraftWeek({ weekStart: "2026-11-09", listings })

describe("TikTok preview-only draft agent", () => {
  it("generates exactly 3 deterministic, unique mixed content slots", () => {
    const drafts = build()
    expect(drafts).toEqual(build())
    expect(drafts).toHaveLength(3)
    expect(drafts.map(d => d.topic)).toEqual(["featured_listing", "how_to_sell", "brand_awareness"])
    expect(new Set(drafts.map(d => d.key)).size).toBe(3)
    expect(drafts.map(d => d.scheduledFor)).toEqual([
      "2026-11-10T15:00:00.000Z",
      "2026-11-12T15:00:00.000Z",
      "2026-11-14T14:00:00.000Z",
    ])
    expect(drafts.every(d => d.status === "draft" && d.qa.passed)).toBe(true)
  })
  it("generates three 9:16 render manifests, NOT published videos", () => {
    expect(TIKTOK_DRAFT_POLICY.weeklyCount).toBe(3)
    expect(TIKTOK_DRAFT_POLICY.autoPublish).toBe(false)
    expect(TIKTOK_DRAFT_POLICY.externalUploads).toBe(false)
    expect(TIKTOK_DRAFT_POLICY.paidBudgetUsd).toBe(0)
    for (const draft of build()) {
      expect(draft.video).toEqual({ width: 1080, height: 1920, fps: 30, durationSeconds: 13, status: "render_pending" })
      expect(draft.frames.map(f => f.durationSeconds).reduce((a, b) => a + b, 0)).toBe(13)
    }
  })
  it("never creates fictional item details if no valid QA listing exists", () => {
    const drafts = build([])
    expect(drafts[0].source).toBe("evergreen")
    expect(drafts[0].listingId).toBeNull()
    expect(drafts.every(d => d.qa.passed)).toBe(true)
    expect(build([{ ...listing, id: "sim-123" }])[0].source).toBe("evergreen")
    expect(build([{ ...listing, imageUrl: "http://unsafe.example/x.jpg" }])[0].source).toBe("evergreen")
    expect(build([{ ...listing, imageUrl: "https://samosell.ge.evil.org/x.jpg" }])[0].source).toBe("evergreen")
  })
  it("never invents a price when listing price is missing", () => {
    const d = build([{ ...listing, priceGel: null }])[0]
    expect(d.caption).toContain("ფასი იხილე განცხადებაში")
    expect(d.caption).not.toContain("35 ₾")
    expect(build([{ ...listing, isGift: true }])[0].caption).toContain("უფასოდ")
  })
  it("fails closed for production and any external effects in preview", () => {
    expect(isTikTokDraftEnvironment("production")).toBe(false)
    expect(isTikTokDraftEnvironment(undefined)).toBe(false)
    expect(isTikTokDraftEnvironment("preview")).toBe(true)
    expect(() => assertTikTokActionAllowed("generate_draft", "production")).toThrow("tiktok_preview_only")
    expect(() => assertTikTokActionAllowed("generate_draft", "preview")).not.toThrow()
    for (const action of ["upload", "publish", "paid_ads"] as const) {
      expect(() => assertTikTokActionAllowed(action, "preview")).toThrow("tiktok_draft_only")
    }
  })
  it("handles Georgia local week near midnight UTC", () => {
    expect(georgianWeekStart(new Date("2026-11-08T21:00:00Z"))).toBe("2026-11-09")
    expect(georgianWeekStart(new Date("2026-11-15T19:59:59Z"))).toBe("2026-11-09")
    expect(() => buildTikTokDraftWeek({ weekStart: "2026-11-10", listings: [] })).toThrow("week_start_must_be_monday")
  })
  it("does not add TikTok to the Meta publishing policy", () => {
    const runtime = resolveSocialRuntime({ VERCEL_ENV: "preview" })
    const decision = evaluateSocialAction({
      actor: "publishing", action: "publish_organic", runtime,
      platform: "tiktok" as "facebook", control: null,
    })
    expect(decision.decision).toBe("deny")
  })
})
