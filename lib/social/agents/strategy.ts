/**
 * Strategy agent — deterministic weekly organic plan.
 * No model calls: the cadence and pillar rotation are fixed rules that can be reviewed and tested.
 */
import type { CandidateListing, Pillar, SocialPlatform } from "../types"

export type PlanSlot = {
  slotKey: string
  scheduledFor: string
  pillar: Pillar
  platforms: SocialPlatform[]
  listing: CandidateListing | null
  listings: CandidateListing[]
}

/** Tbilisi is UTC+4 all year (no DST). */
const TBILISI_OFFSET_HOURS = 4
/**
 * Posting slots (Tbilisi time), set 2026-11-23 from SamoSell's own site activity (growth_events,
 * 60 days, 815 visitors): the busiest hours were 15:00 and 21:00–22:00, and the busiest days
 * Fri > Sun > Thu > Mon > Sat; Tue/Wed were the weakest. Meta does not publish universal best times;
 * its per-account "most active times" appears only from 100 Instagram followers, so these
 * slots are a data-based starting point, to be revisited with post-level results.
 * Keep the pg_cron publish tick (UTC hours) in sync: tests/SocialSchedule.test.ts checks it.
 */
const SLOTS: ReadonlyArray<{ dayOffset: number; hourLocal: number; pillar: Pillar }> = [
  { dayOffset: 0, hourLocal: 21, pillar: "featured_listing" }, // Monday
  { dayOffset: 3, hourLocal: 21, pillar: "how_to_sell" },      // Thursday
  { dayOffset: 4, hourLocal: 15, pillar: "giveaway" },         // Friday
  { dayOffset: 5, hourLocal: 15, pillar: "category_roundup" }, // Saturday
  { dayOffset: 6, hourLocal: 21, pillar: "trust" },            // Sunday
]

/** Day offset of every slot, aligned with weekSlotTimes(); slot keys are plan:<week>:<dayOffset>:<pillar>. */
export const SLOT_DAY_OFFSETS: readonly number[] = SLOTS.map(s => s.dayOffset)

export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - (day - 1))
  return d.toISOString().slice(0, 10)
}

function usable(listing: CandidateListing) {
  return Boolean(listing.imageUrl?.startsWith("https://") && listing.title.trim().length >= 3)
}

/** Every slot time of a week (UTC ISO), in plan order — used for status and gap detection. */
export function weekSlotTimes(weekStart: string): string[] {
  const start = new Date(`${weekStart}T00:00:00Z`)
  return SLOTS.map(slot => slotTime(start, slot.dayOffset, slot.hourLocal).toISOString())
}

function slotTime(start: Date, dayOffset: number, hourLocal: number) {
  const at = new Date(start)
  at.setUTCDate(at.getUTCDate() + dayOffset)
  at.setUTCHours(hourLocal - TBILISI_OFFSET_HOURS, 0, 0, 0)
  return at
}

/**
 * notBefore: slots earlier than this are skipped (used to fill the rest of the current week).
 * excludeListingIds: items already featured recently/upcoming are used only if nothing else is left.
 */
export function buildWeeklyPlan(input: { weekStart: string; listings: CandidateListing[]; platforms: SocialPlatform[]; notBefore?: string; excludeListingIds?: Iterable<string> }): PlanSlot[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)) throw new Error("invalid_week_start")
  const start = new Date(`${input.weekStart}T00:00:00Z`)
  if (start.getUTCDay() !== 1) throw new Error("week_must_start_monday")
  if (input.platforms.length === 0) return []
  const pool = input.listings.filter(usable)
  const gifts = pool.filter(l => l.isGift)
  const regular = pool.filter(l => !l.isGift)
  const used = new Set<string>()
  const recent = new Set(input.excludeListingIds ?? [])
  const notBefore = input.notBefore ? Date.parse(input.notBefore) : Number.NEGATIVE_INFINITY
  const usedEvergreen = new Set<Pillar>()
  const take = (source: CandidateListing[]) => {
    const found = source.find(l => !used.has(l.id) && !recent.has(l.id)) ?? source.find(l => !used.has(l.id))
    if (found) used.add(found.id)
    return found ?? null
  }

  const slots: PlanSlot[] = []
  for (const slot of SLOTS) {
    const at = slotTime(start, slot.dayOffset, slot.hourLocal)
    if (at.getTime() < notBefore) continue
    let pillar: Pillar = slot.pillar
    let listing: CandidateListing | null = null
    let listings: CandidateListing[] = []
    if (pillar === "featured_listing") listing = take(regular)
    if (pillar === "giveaway") {
      listing = take(gifts)
      // No real giveaway listing → never invent one; feature another real item instead.
      if (!listing) { pillar = "featured_listing"; listing = take(regular) }
    }
    if (pillar === "category_roundup") {
      const picks: CandidateListing[] = []
      for (let i = 0; i < 4; i++) { const l = take(regular); if (l) picks.push(l) }
      if (picks.length >= 2) listings = picks
      else { picks.forEach(p => used.delete(p.id)); pillar = "trust" }
    }
    if (pillar === "featured_listing" && !listing) pillar = "trust"
    // Never schedule the same evergreen post twice in one week.
    if ((pillar === "trust" || pillar === "how_to_sell") && usedEvergreen.has(pillar)) {
      const other = pillar === "trust" ? "how_to_sell" : "trust"
      if (usedEvergreen.has(other)) continue
      pillar = other
    }
    if (pillar === "trust" || pillar === "how_to_sell") usedEvergreen.add(pillar)
    slots.push({
      slotKey: `plan:${input.weekStart}:${slot.dayOffset}:${slot.pillar}`,
      scheduledFor: at.toISOString(),
      pillar,
      platforms: [...input.platforms],
      listing,
      listings,
    })
  }
  return slots
}
