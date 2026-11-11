/**
 * TikTok Draft Agent v1. No TikTok SDK, OAuth, uploads, external fetch or publish calls.
 * Separate from the Meta SocialPlatform union, Meta worker and DB publish queue.
 * Produces editable storyboards / video render manifests, NOT playable MP4 files.
 */
import type { CandidateListing } from "../social/types"

export const TIKTOK_DRAFT_POLICY = Object.freeze({
  weeklyCount: 3,
  contentMix: ["featured_listing", "how_to_sell", "brand_awareness"] as const,
  status: "draft_only" as const,
  autoPublish: false,
  externalUploads: false,
  paidBudgetUsd: 0,
  aspectRatio: "9:16" as const,
  width: 1080,
  height: 1920,
  fps: 30,
})

export type TikTokTopic = (typeof TIKTOK_DRAFT_POLICY.contentMix)[number]
export type TikTokFrame = { index: number; durationSeconds: number; heading: string; detail: string; imageUrl: string | null }
export type TikTokDraft = {
  key: string
  weekStart: string
  scheduledFor: string
  topic: TikTokTopic
  caption: string
  listingId: string | null
  source: "listing" | "evergreen"
  frames: TikTokFrame[]
  status: "draft"
  qa: { passed: boolean; errors: string[] }
  video: { width: 1080; height: 1920; fps: 30; durationSeconds: number; status: "render_pending" }
}

const DAY = 86_400_000
const TZ = 4 * 60 * 60 * 1000
const TITLE_LIMIT = 100
const PHONE = /(?:\+?995[\s-]?)?(?:5\d{2}|32)[\s-]?\d{2,3}[\s-]?\d{2}[\s-]?\d{2,3}/
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i
const BAD_CLAIM = /გარანტირებულ|100%\s*ორიგინალ|ყველაზე\s+იაფ|guaranteed|original\s*100/i

/** Monday of the Georgian local week, including Sunday UTC boundary. */
export function georgianWeekStart(now: Date): string {
  const local = new Date(now.getTime() + TZ)
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - ((local.getUTCDay() + 6) % 7) * DAY
  return new Date(monday).toISOString().slice(0, 10)
}
function validHttpsMedia(url: string | null): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === "https:" && (
      u.hostname === "samosell.ge" ||
      u.hostname === "www.samosell.ge" ||
      /^[a-z0-9]{20}\.supabase\.co$/.test(u.hostname)
    )
  } catch { return false }
}
function cleaned(text: string, max: number): string {
  return text.replace(/[\r\n\t]+/g, " ").trim().slice(0, max)
}
function review(draft: Pick<TikTokDraft, "caption" | "frames" | "scheduledFor">): TikTokDraft["qa"] {
  const errors: string[] = []
  if (draft.frames.length !== 3 || draft.frames.some(f => f.durationSeconds <= 0)) errors.push("invalid_timeline")
  if (draft.frames.some(f => BAD_CLAIM.test(f.heading + " " + f.detail)) || BAD_CLAIM.test(draft.caption)) errors.push("unverified_claim")
  if (draft.frames.some(f => PHONE.test(f.heading + " " + f.detail) || EMAIL.test(f.heading + " " + f.detail))
    || PHONE.test(draft.caption) || EMAIL.test(draft.caption)) errors.push("personal_data")
  if (draft.frames.some(f => f.imageUrl !== null && !validHttpsMedia(f.imageUrl))) errors.push("untrusted_media")
  if (!Number.isFinite(Date.parse(draft.scheduledFor))) errors.push("invalid_date")
  return { passed: errors.length === 0, errors }
}
const BRAND = "https://samosell.ge/brand/samosell-social-brand.jpg"
function schedule(weekStart: string, dayOffset: number, localHour: number): string {
  const t = new Date(weekStart + "T00:00:00.000Z")
  if (Number.isNaN(t.getTime()) || t.getUTCDay() !== 1 || t.toISOString().slice(0, 10) !== weekStart) throw new Error("week_start_must_be_monday")
  return new Date(t.getTime() + dayOffset * DAY + localHour * 3_600_000 - TZ).toISOString()
}

/**
 * Deterministic idempotency keys. No persistence and no duplicate API side effects.
 * Never invent product prices, gifts or images. Unusable listing -> evergreen topic.
 */
export function buildTikTokDraftWeek(input: { weekStart: string; listings: CandidateListing[] }): TikTokDraft[] {
  const slots = [
    { day: 1, hour: 19, topic: "featured_listing" as TikTokTopic },
    { day: 3, hour: 19, topic: "how_to_sell" as TikTokTopic },
    { day: 5, hour: 18, topic: "brand_awareness" as TikTokTopic },
  ]
  const usable = input.listings.find(l =>
    Boolean(l.id && l.slug && l.title.trim().length >= 3 && validHttpsMedia(l.imageUrl)) && !l.id.startsWith("sim-"))
  return slots.map(({ day, hour, topic }) => {
    const featured = topic === "featured_listing" && usable
    const title = featured ? cleaned(usable.title, TITLE_LIMIT) : ""
    const price = featured ? (usable.isGift ? "უფასოდ" : usable.priceGel !== null && Number.isFinite(usable.priceGel) && usable.priceGel > 0 ? `${Math.round(usable.priceGel)} ₾` : "ფასი იხილე განცხადებაში") : ""
    const frames: TikTokFrame[] = featured ? [
      { index: 1, durationSeconds: 4, heading: "დღის აღმოჩენა", detail: title, imageUrl: usable.imageUrl },
      { index: 2, durationSeconds: 5, heading: price, detail: cleaned(usable.city ?? "SamoSell", 60), imageUrl: usable.imageUrl },
      { index: 3, durationSeconds: 4, heading: "აღმოაჩინე SamoSell-ზე", detail: "მოძებნე ნივთი საიტზე", imageUrl: BRAND },
    ] : topic === "how_to_sell" ? [
      { index: 1, durationSeconds: 4, heading: "გინდა გაყიდო ტანსაცმელი?", detail: "გადაუღე ხარისხიანი ფოტო", imageUrl: BRAND },
      { index: 2, durationSeconds: 5, heading: "მიუთითე ზომა და ფასი", detail: "აღწერე რეალური მდგომარეობა", imageUrl: BRAND },
      { index: 3, durationSeconds: 4, heading: "განათავსე SamoSell-ზე", detail: "გაუზიარე შენს მყიდველს", imageUrl: BRAND },
    ] : [
      { index: 1, durationSeconds: 4, heading: "ახალი სტილი იწყება აქ", detail: "აღმოაჩინე საინტერესო ნივთები", imageUrl: BRAND },
      { index: 2, durationSeconds: 5, heading: "მიეცი ნივთს მეორე სიცოცხლე", detail: "იპოვე ან განათავსე განცხადება", imageUrl: BRAND },
      { index: 3, durationSeconds: 4, heading: "SamoSell.ge", detail: "შენი ონლაინ სივრცე", imageUrl: BRAND },
    ]
    const caption = featured
      ? `✨ ${title} · ${price}. იხილე SamoSell.ge-ზე #SamoSell #მოდა #საქართველო`
      : topic === "how_to_sell"
        ? "შენი კარადის ნივთები ახალ მფლობელს ელოდება. განათავსე SamoSell-ზე. #SamoSell #გაყიდვა #საქართველო"
        : "შენი სტილი. ახალი აღმოჩენები. SamoSell.ge #SamoSell #მოდა #საქართველო"
    const scheduledFor = schedule(input.weekStart, day, hour)
    const draft = {
      key: `tiktok:draft:v1:${input.weekStart}:${topic}`,
      weekStart: input.weekStart, scheduledFor,
      topic, caption,
      listingId: featured ? usable.id : null,
      source: featured ? "listing" as const : "evergreen" as const,
      frames,
      status: "draft" as const,
      video: { width: 1080 as const, height: 1920 as const, fps: 30 as const, durationSeconds: 13, status: "render_pending" as const },
    }
    return { ...draft, qa: review(draft) }
  })
}

/** Fail-closed: even if the route is accidentally included in a production deployment. */
export function isTikTokDraftEnvironment(environment: string | undefined): boolean {
  return environment === "preview" || environment === "development" || environment === "test"
}

/** Explicit capability gate — cannot upload, schedule external jobs, or publish. */
export function assertTikTokActionAllowed(action: "generate_draft" | "upload" | "publish" | "paid_ads", environment: string | undefined) {
  if (!isTikTokDraftEnvironment(environment)) throw new Error("tiktok_preview_only")
  if (action !== "generate_draft") throw new Error("tiktok_draft_only")
}
