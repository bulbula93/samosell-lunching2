import type { PublishJob, SocialPost, MetricRow } from "./types"

export type WeeklyGoal = {
  id: string
  title: string
  done: number
  target: number
  state: "complete" | "in_progress" | "blocked" | "unverified"
  note: string
}

function weekRange(now: Date): { start: Date; end: Date; label: string } {
  // Georgia has UTC+04:00 year-round. Calculate weekdays from the local date,
  // not the server's timezone (Vercel functions run in UTC).
  const local = new Date(now.getTime() + 4 * 60 * 60 * 1000)
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  const offset = (local.getUTCDay() + 6) % 7
  const start = new Date(midnight - offset * 86400000 - 4 * 3600000)
  const end = new Date(start.getTime() + 7 * 86400000)
  const fmt = new Intl.DateTimeFormat("ka-GE", { timeZone: "Asia/Tbilisi", month: "short", day: "numeric" })
  return { start, end, label: `${fmt.format(start)} – ${fmt.format(new Date(end.getTime() - 1))}` }
}

export function getWeeklySocialGoals(input: {
  posts: SocialPost[]
  jobs: PublishJob[]
  metrics: MetricRow[]
  now?: Date
}): { label: string; goals: WeeklyGoal[]; completed: number; verifiable: number; planned: number } {
  const { start, end, label } = weekRange(input.now ?? new Date())
  const inWeek = (iso: string) => {
    const t = Date.parse(iso)
    return Number.isFinite(t) && t >= start.getTime() && t < end.getTime()
  }
  const posts = input.posts.filter(p => inWeek(p.scheduledFor))
  const postById = new Map(posts.map(p => [p.id, p]))
  // Only a confirmed LIVE publish job is evidence of an actual Meta publication.
  // A dry_run_completed job must never increment the completed count.
  const confirmed = input.jobs.filter(j =>
    j.executionMode === "live" && j.status === "published" &&
    Boolean(j.externalPostId) && postById.has(j.postId))
  const count = (platform: "facebook" | "instagram", story: boolean) =>
    new Set(confirmed.filter(j =>
      j.platform === platform && (postById.get(j.postId)?.contentType === "story") === story,
    ).map(j => j.postId)).size
  const planned = posts.filter(p => !["rejected", "cancelled", "failed"].includes(p.status)).length
  const publishing = (id: string, title: string, platform: "facebook" | "instagram", story: boolean, target: number): WeeklyGoal => {
    const done = count(platform, story)
    const scheduled = posts.filter(p => p.platforms.includes(platform) &&
      (p.contentType === "story") === story && !["cancelled", "rejected"].includes(p.status)).length
    return {
      id, title, done, target, state: done >= target ? "complete" : "in_progress",
      note: `დადასტურებულია მხოლოდ live Meta publish ID-ით · დაგეგმილია: ${scheduled}`,
    }
  }
  const goals: WeeklyGoal[] = [
    publishing("fb-posts", "Facebook პოსტები", "facebook", false, 2),
    publishing("ig-posts", "Instagram პოსტები", "instagram", false, 2),
    publishing("fb-story", "Facebook Story", "facebook", true, 1),
    publishing("ig-story", "Instagram Story", "instagram", true, 1),
    {
      id: "insights", title: "Insights-ის ანალიზი", done: 0, target: 1,
      state: "unverified",
      note: input.metrics.some(m => inWeek(m.metricDate + "T12:00:00+04:00"))
        ? "ამ კვირის მეტრიკები არსებობს, მაგრამ Insights-ის მონახულება არ დასტურდება"
        : "Metrics sync ჯერ არ დასტურდება; Meta-ის ჩექლისტის მონიშვნა API-ით არ მოწმდება",
    },
    { id: "responses", title: "პასუხების მაჩვენებელი", done: 0, target: 1,
      state: "unverified", note: "Meta inbox-ის response rate-ის ინტეგრაცია ჯერ არ არის დადასტურებული" },
    { id: "paid", title: "ფასიანი რეკლამა", done: 0, target: 1, state: "blocked",
      note: "Approval required · დღიური ბიუჯეტის ლიმიტი $0 · ავტომატური გაშვება აკრძალულია" },
  ]
  return {
    label, goals,
    completed: goals.filter(g => g.state === "complete").length,
    verifiable: goals.filter(g => g.state !== "blocked" && g.state !== "unverified").length,
    planned,
  }
}
