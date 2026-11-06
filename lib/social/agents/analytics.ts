/** Analytics agent — pure aggregation of stored daily metrics. */
import type { MetricRow, Pillar, SocialPlatform } from "../types"

export type PostPerformance = { postId: string; platform: SocialPlatform; reach: number; engagements: number; engagementRate: number; linkClicks: number }
export type AnalyticsSummary = {
  posts: number
  totalReach: number
  totalEngagements: number
  avgEngagementRate: number
  byPlatform: Record<SocialPlatform, { reach: number; engagements: number }>
  bestPillar: Pillar | null
  top: PostPerformance[]
}

export function summarizeMetrics(rows: MetricRow[], pillars: Record<string, Pillar> = {}): AnalyticsSummary {
  const perPost = new Map<string, PostPerformance>()
  const byPlatform: AnalyticsSummary["byPlatform"] = { instagram: { reach: 0, engagements: 0 }, facebook: { reach: 0, engagements: 0 } }
  for (const r of rows) {
    const key = `${r.postId}:${r.platform}`
    const engagements = r.likes + r.comments + r.shares + r.saves
    const current = perPost.get(key) ?? { postId: r.postId, platform: r.platform, reach: 0, engagements: 0, engagementRate: 0, linkClicks: 0 }
    current.reach += r.reach
    current.engagements += engagements
    current.linkClicks += r.linkClicks
    perPost.set(key, current)
    byPlatform[r.platform].reach += r.reach
    byPlatform[r.platform].engagements += engagements
  }
  const list = [...perPost.values()].map(p => ({ ...p, engagementRate: p.reach > 0 ? p.engagements / p.reach : 0 }))
  const pillarScores = new Map<Pillar, { sum: number; n: number }>()
  for (const p of list) {
    const pillar = pillars[p.postId]
    if (!pillar) continue
    const s = pillarScores.get(pillar) ?? { sum: 0, n: 0 }
    s.sum += p.engagementRate; s.n += 1
    pillarScores.set(pillar, s)
  }
  let bestPillar: Pillar | null = null, best = -1
  for (const [pillar, s] of pillarScores) if (s.sum / s.n > best) { best = s.sum / s.n; bestPillar = pillar }
  const totalReach = list.reduce((a, p) => a + p.reach, 0)
  const totalEngagements = list.reduce((a, p) => a + p.engagements, 0)
  return {
    posts: new Set(list.map(p => p.postId)).size,
    totalReach,
    totalEngagements,
    avgEngagementRate: totalReach > 0 ? totalEngagements / totalReach : 0,
    byPlatform,
    bestPillar,
    top: list.sort((a, b) => b.engagementRate - a.engagementRate || b.reach - a.reach).slice(0, 5),
  }
}
