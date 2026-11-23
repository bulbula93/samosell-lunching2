/**
 * Daily Meta results sync (read-only).
 *
 * What Meta gives a small account (verified against Meta docs, 2026-11):
 *  - Instagram media insights (reach, likes, comments, shares, saved, views) — no follower minimum.
 *  - Instagram followers_count; online_followers only from 100 followers (empty below that).
 *  - Facebook: Page/post Insights need 100+ likes and page_fans_online is deprecated, so for Facebook
 *    we read the public engagement counters on the post/photo itself (reactions, comments, shares).
 * Every call is GET, bounded by a deadline, and never throws to the caller: errors are counted and
 * the first error code is stored so the admin page can say exactly what is missing (e.g. a permission).
 */
import { MetaGraphClient, PublishError, igTarget, pageTarget, type MetaCredentials } from "./adapters/meta"
import { evaluateSocialAction } from "./policy-gateway"
import type { SocialRuntime } from "./runtime"
import type { SocialStore } from "./store"
import type { AccountStats, InsightTarget, MetricRow, SlotVisits, SocialPlatform } from "./types"

export type GraphCaller = Pick<MetaGraphClient, "call">
export type InsightsResult = {
  state: "stopped" | "ran"
  posts: number
  updated: number
  failed: number
  firstError: string | null
  accounts: Array<{ platform: SocialPlatform; followers: number | null; activeHours: boolean; errorCode: string | null }>
}

/** Instagram returns online_followers from this many followers. */
export const IG_ACTIVE_HOURS_MIN_FOLLOWERS = 100
/** Instagram keeps Story insights only while the Story is live. */
export const STORY_INSIGHTS_WINDOW_MS = 24 * 3600_000
const IG_FEED_METRICS = "reach,likes,comments,shares,saved,views"
const IG_STORY_METRICS = "reach,views,shares"

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0)
const errCode = (e: unknown) => (e instanceof PublishError ? e.code : "insights_failed")

/** The post's calendar date in Tbilisi (UTC+4): one stored row per post/platform. */
export function tbilisiDate(iso: string) {
  return new Date(Date.parse(iso) + 4 * 3600_000).toISOString().slice(0, 10)
}

/** Pure: Graph `/insights` response → named totals. Handles both `values[0].value` and `total_value.value`. */
export function readInsightValues(body: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {}
  const data = Array.isArray(body.data) ? body.data : []
  for (const item of data) {
    if (!item || typeof item !== "object") continue
    const m = item as Record<string, unknown>
    const name = typeof m.name === "string" ? m.name : null
    if (!name) continue
    const total = m.total_value && typeof m.total_value === "object" ? (m.total_value as Record<string, unknown>).value : undefined
    const first = Array.isArray(m.values) && m.values[0] && typeof m.values[0] === "object" ? (m.values[0] as Record<string, unknown>).value : undefined
    out[name] = n(total ?? first)
  }
  return out
}

/** Pure: online_followers `value` is an object of hour → followers; keep only 0..23 numeric entries. */
export function readActiveHours(body: Record<string, unknown>): Record<string, number> | null {
  const data = Array.isArray(body.data) ? body.data : []
  const metric = data.find(d => d && typeof d === "object" && (d as Record<string, unknown>).name === "online_followers") as Record<string, unknown> | undefined
  const values = metric && Array.isArray(metric.values) ? metric.values : []
  const latest = values.at(-1) as Record<string, unknown> | undefined
  const raw = latest && latest.value && typeof latest.value === "object" ? latest.value as Record<string, unknown> : null
  if (!raw) return null
  const hours: Record<string, number> = {}
  for (const [h, v] of Object.entries(raw)) if (/^([0-9]|1[0-9]|2[0-3])$/.test(h)) hours[h] = n(v)
  return Object.keys(hours).length ? hours : null
}

const summaryCount = (v: unknown) => {
  const s = v && typeof v === "object" ? (v as Record<string, unknown>).summary : null
  return s && typeof s === "object" ? n((s as Record<string, unknown>).total_count) : 0
}

async function instagramPost(ig: GraphCaller, t: InsightTarget): Promise<MetricRow> {
  const story = t.contentType === "story"
  const body = await ig.call("GET", `${t.externalPostId}/insights`, { metric: story ? IG_STORY_METRICS : IG_FEED_METRICS }, false)
  const v = readInsightValues(body)
  return { postId: t.postId, platform: "instagram", metricDate: tbilisiDate(t.scheduledFor), impressions: v.views ?? 0, reach: v.reach ?? 0, likes: v.likes ?? 0, comments: v.comments ?? 0, shares: v.shares ?? 0, saves: v.saved ?? 0, linkClicks: 0 }
}

async function facebookPost(fb: GraphCaller, t: InsightTarget): Promise<MetricRow> {
  // page_post ids ("123_456") are feed posts and have shares; bare ids are photos (likes, comments).
  const isFeedPost = t.externalPostId.includes("_")
  const fields = isFeedPost
    ? "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares"
    : "likes.summary(total_count).limit(0),comments.summary(total_count).limit(0)"
  const body = await fb.call("GET", t.externalPostId, { fields }, false)
  const shares = body.shares && typeof body.shares === "object" ? n((body.shares as Record<string, unknown>).count) : 0
  return { postId: t.postId, platform: "facebook", metricDate: tbilisiDate(t.scheduledFor), impressions: 0, reach: 0, likes: summaryCount(isFeedPost ? body.reactions : body.likes), comments: summaryCount(body.comments), shares, saves: 0, linkClicks: 0 }
}

export async function syncInsights(opts: {
  store: SocialStore
  runtime: SocialRuntime
  credentials: MetaCredentials | null
  clients?: { instagram: GraphCaller; facebook: GraphCaller }
  now?: () => number
  deadlineMs?: number
  sinceDays?: number
}): Promise<InsightsResult> {
  const now = opts.now ?? Date.now
  const started = now()
  const empty: InsightsResult = { state: "stopped", posts: 0, updated: 0, failed: 0, firstError: null, accounts: [] }
  const control = await opts.store.getControl()
  const gate = evaluateSocialAction({ actor: "analytics", action: "sync_metrics", runtime: opts.runtime, control })
  if (gate.decision !== "allow") {
    await opts.store.appendAudit({ actorType: "agent", actor: "analytics", action: "sync_metrics", decision: "deny", reason: gate.reason, resourceType: "insights", resourceId: null })
    return { ...empty, firstError: gate.reason }
  }
  if (!opts.credentials && !opts.clients) return { ...empty, firstError: "meta_credentials_missing" }
  const ig = opts.clients?.instagram ?? new MetaGraphClient(igTarget(opts.credentials!))
  const system = opts.clients?.facebook ?? new MetaGraphClient(pageTarget(opts.credentials!))
  // Like FacebookLiveAdapter: post/photo engagement must be read with the Page access token,
  // not the system-user token (that one only reads Page-level fields such as followers_count).
  let fb: GraphCaller = system
  if (!opts.clients && opts.credentials) {
    try {
      const r = await system.call("GET", opts.credentials.pageId, { fields: "access_token" }, false)
      if (typeof r.access_token === "string" && r.access_token.length >= 20) fb = new MetaGraphClient({ ...pageTarget(opts.credentials), token: r.access_token })
    } catch { /* keep the system client; post reads will report the permission error */ }
  }
  const deadline = opts.deadlineMs ?? 40_000
  const result: InsightsResult = { ...empty, state: "ran" }
  const fail = (code: string) => { result.failed++; result.firstError ??= code }

  // 1) Accounts: followers for both, Instagram active hours when Meta allows it.
  const accounts: Array<Omit<AccountStats, "syncedAt">> = []
  const creds = opts.credentials
  try {
    const me = await ig.call("GET", creds?.igUserId ?? "me", { fields: "followers_count" }, false)
    const followers = typeof me.followers_count === "number" ? n(me.followers_count) : null
    let activeHours: Record<string, number> | null = null
    let errorCode: string | null = null
    if (followers !== null && followers >= IG_ACTIVE_HOURS_MIN_FOLLOWERS) {
      try { activeHours = readActiveHours(await ig.call("GET", `${creds?.igUserId ?? "me"}/insights`, { metric: "online_followers", period: "lifetime" }, false)) }
      catch (e) { errorCode = errCode(e) }
    }
    accounts.push({ platform: "instagram", followers, activeHours, errorCode })
  } catch (e) { accounts.push({ platform: "instagram", followers: null, activeHours: null, errorCode: errCode(e) }); fail(errCode(e)) }
  try {
    const page = await system.call("GET", creds?.pageId ?? "me", { fields: "followers_count" }, false)
    accounts.push({ platform: "facebook", followers: typeof page.followers_count === "number" ? n(page.followers_count) : null, activeHours: null, errorCode: null })
  } catch (e) { accounts.push({ platform: "facebook", followers: null, activeHours: null, errorCode: errCode(e) }); fail(errCode(e)) }

  // 2) Posts of the last N days, newest first, until the deadline.
  const since = new Date(started - (opts.sinceDays ?? 30) * 864e5).toISOString()
  const targets = await opts.store.listInsightTargets(since, 60)
  result.posts = targets.length
  const rows: MetricRow[] = []
  const postErrors: Partial<Record<SocialPlatform, string>> = {}
  for (const t of targets) {
    if (now() - started > deadline) break
    const isStory = t.contentType === "story"
    // Facebook exposes no engagement counters for Page Stories; skip them.
    if (isStory && t.platform === "facebook") continue
    // Instagram Story insights exist only while the Story is live (24 h): older ones are not errors.
    if (isStory && now() - Date.parse(t.scheduledFor) > STORY_INSIGHTS_WINDOW_MS) continue
    try { rows.push(t.platform === "instagram" ? await instagramPost(ig, t) : await facebookPost(fb, t)) }
    catch (e) {
      if (isStory) continue
      fail(errCode(e)); postErrors[t.platform] ??= errCode(e)
    }
  }
  await opts.store.upsertMetrics(rows)
  result.updated = rows.length

  for (const a of accounts) {
    const stats = { ...a, errorCode: a.errorCode ?? postErrors[a.platform] ?? null }
    await opts.store.upsertAccountStats(stats)
    result.accounts.push({ platform: a.platform, followers: a.followers, activeHours: Boolean(a.activeHours), errorCode: stats.errorCode })
  }
  await opts.store.appendAudit({
    actorType: "agent", actor: "analytics", action: "sync_metrics", decision: result.failed && !result.updated ? "failure" : "success",
    reason: result.failed ? "metrics_synced_with_errors" : "metrics_synced", resourceType: "insights", resourceId: null,
    details: { posts: result.posts, updated: result.updated, failed: result.failed, first_error: result.firstError, ig_followers: result.accounts.find(a => a.platform === "instagram")?.followers ?? null, fb_followers: result.accounts.find(a => a.platform === "facebook")?.followers ?? null },
  })
  return result
}

/** Pure (tested): group campaign events by utm_content into visitors, page views and chats started. */
export function aggregateSlotVisits(rows: Array<Record<string, unknown>>): SlotVisits[] {
  const by = new Map<string, { visitors: Set<string>; pageViews: number; contacts: number }>()
  for (const r of rows) {
    const touch = (r.last_touch && typeof r.last_touch === "object" ? r.last_touch : {}) as Record<string, unknown>
    const key = typeof touch.utm_content === "string" && touch.utm_content ? touch.utm_content : "untagged"
    const g = by.get(key) ?? { visitors: new Set<string>(), pageViews: 0, contacts: 0 }
    const who = String(r.user_id ?? r.anonymous_id ?? "")
    if (r.event_name === "page_view") { g.pageViews++; if (who) g.visitors.add(who) }
    if (r.event_name === "buyer_contact_started") g.contacts++
    by.set(key, g)
  }
  return [...by.entries()].map(([utmContent, g]) => ({ utmContent, visitors: g.visitors.size, pageViews: g.pageViews, contacts: g.contacts }))
    .sort((a, b) => b.visitors - a.visitors || a.utmContent.localeCompare(b.utmContent))
}

export type SlotPerformance = { slot: string; posts: number; reach: number; engagements: number; visitors: number; contacts: number }

/**
 * Pure: results per posting slot (Tbilisi weekday + hour), for deciding when to post.
 * `posts` maps post id → { scheduledFor, utm } so site visits from utm_content can be joined in.
 */
export function slotPerformance(metrics: MetricRow[], posts: Array<{ id: string; scheduledFor: string; utm: string }>, visits: SlotVisits[]): SlotPerformance[] {
  const fmt = new Intl.DateTimeFormat("ka-GE", { timeZone: "Asia/Tbilisi", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
  const visitBy = new Map(visits.map(v => [v.utmContent, v]))
  const by = new Map<string, SlotPerformance>()
  const seen = new Set<string>()
  for (const p of posts) {
    const slot = fmt.format(new Date(p.scheduledFor))
    const s = by.get(slot) ?? { slot, posts: 0, reach: 0, engagements: 0, visitors: 0, contacts: 0 }
    const own = metrics.filter(m => m.postId === p.id)
    if (!own.length && !visitBy.has(p.utm)) continue
    if (!seen.has(p.id)) { s.posts++; seen.add(p.id) }
    for (const m of own) { s.reach += m.reach; s.engagements += m.likes + m.comments + m.shares + m.saves }
    const v = visitBy.get(p.utm)
    if (v) { s.visitors += v.visitors; s.contacts += v.contacts }
    by.set(slot, s)
  }
  return [...by.values()].sort((a, b) => b.visitors - a.visitors || b.reach - a.reach)
}
