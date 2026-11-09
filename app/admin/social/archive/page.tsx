import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import { currentSocialRuntime } from "@/lib/social/runtime"
import { createSocialStore } from "@/lib/social/supabase-store"
import { PLATFORM_LABEL } from "@/lib/social/store"
import type { SocialPost } from "@/lib/social/types"
import { PlatformPreview, StoryPreview } from "../previews"

export const dynamic = "force-dynamic"
export const metadata = { title: "კამპანიების არქივი | SamoSell", robots: { index: false, follow: false } }

// Calendar weeks are Monday–Sunday in Georgia (Asia/Tbilisi, UTC+4; no DST).
const DAY = 86_400_000
const HOUR = 3_600_000
const OFFSET = 4 * HOUR
const TERMINAL = new Set<SocialPost["status"]>(["published", "rejected", "cancelled", "failed"])
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const mondayUtc = (ms: number) => {
  const local = new Date(ms + OFFSET)
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return midnight - ((local.getUTCDay() + 6) % 7) * DAY
}
const weekLocal = (post: SocialPost) => mondayUtc(new Date(post.scheduledFor).getTime())
const formatDate = (ms: number) => new Intl.DateTimeFormat("ka-GE", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(ms))
const formatTime = (iso: string) => new Intl.DateTimeFormat("ka-GE", { timeZone: "Asia/Tbilisi", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

export default async function SocialArchive({ searchParams }: { searchParams: Promise<{ page?: string; week?: string }> }) {
  await requireAdminUser("/dashboard")
  const params = await searchParams
  const rawPage = Number(params.page ?? "0")
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 260 ? rawPage : 0
  const currentWeek = mondayUtc(Date.now())
  const firstWeek = currentWeek - (page * 12 + 12) * 7 * DAY
  const lastWeek = currentWeek - page * 12 * 7 * DAY
  const runtime = currentSocialRuntime()
  const store = createSocialStore(runtime)
  if (!store) {
    return <main className="ui-container ui-section space-y-5"><Link href="/admin/social" className="text-sm font-bold underline">← AI მარკეტინგი</Link><h1 className="text-2xl font-black">კამპანიების არქივი</h1><p role="status">არქივის მონაცემთა ბაზა ამ გარემოში მიუწვდომელია ({runtime.backendReason}). სატესტო პოსტები არქივად არ ინახება.</p></main>
  }

  // Conversion from Tbilisi calendar midnight to UTC timestamp.
  // Range excludes the ongoing week. Existing posts remain in the database untouched.
  let posts: SocialPost[]
  try {
    posts = await store.listPosts(new Date(firstWeek - OFFSET).toISOString(), new Date(lastWeek - OFFSET).toISOString(), 500)
  } catch {
    return <main className="ui-container ui-section space-y-5"><Link href="/admin/social" className="text-sm font-bold underline">← AI მარკეტინგი</Link><h1 className="text-2xl font-black">კამპანიების არქივი</h1><p role="alert">არქივის წაკითხვა ვერ მოხერხდა. მონაცემები არ შეცვლილა.</p></main>
  }

  const weeks = new Map<number, SocialPost[]>()
  for (const post of posts) {
    const key = weekLocal(post)
    if (key >= firstWeek && key < lastWeek) weeks.set(key, [...(weeks.get(key) ?? []), post])
  }
  const sorted = [...weeks.entries()].sort((a, b) => b[0] - a[0])
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(params.week ?? "") ? params.week : null
  const selectedWeek = sorted.find(([key]) => dateOnly(key) === selected)
  const folderUrl = (key: number) => `/admin/social/archive?page=${page}&week=${dateOnly(key)}`
  const jobs = selectedWeek ? await store.listJobs(500).catch(() => []) : []
  const postIds = new Set(selectedWeek?.[1].map(post => post.id) ?? [])
  const selectedJobs = jobs.filter(job => postIds.has(job.postId))
  const metricRows = selectedWeek ? await store.listMetrics(dateOnly(firstWeek)).catch(() => []) : []
  const selectedMetrics = metricRows.filter(metric => postIds.has(metric.postId))

  return <main className="ui-container ui-section space-y-6">
    <header className="ui-card p-6">
      <Link href="/admin/social" className="text-sm font-bold underline">← AI Marketing Control Center</Link>
      <h1 className="mt-4 text-3xl font-black">კვირის კამპანიების არქივი</h1>
      <p className="mt-2 text-sm text-text-soft">დასრულებული კალენდარული კვირები ავტომატურად გამოჩნდება ცალკე საქაღალდეებად. პოსტები, ტექსტები, ფოტოები და გამოქვეყნების სტატუსები არსებული ბაზიდან იკითხება; ჩანაწერები არ იშლება და ხელახლა არ ქვეყნდება.</p>
    </header>
    <section aria-label="Archived campaign folders" className="ui-card p-5 sm:p-6">
      <h2 className="text-xl font-bold">დასრულებული კვირები</h2>
      {posts.length === 500 ? <p role="alert" className="mt-2 text-sm text-amber-700">ამ პერიოდში 500 ჩანაწერის ლიმიტი მიღწეულია — შედეგი შესაძლოა არასრული იყოს.</p> : null}
      {sorted.length === 0 ? <p className="mt-4 text-sm text-text-soft">ამ პერიოდში კამპანიები არ არის.</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map(([key, items]) => {
          const unresolved = items.filter(p => !TERMINAL.has(p.status)).length
          return <Link key={key} href={folderUrl(key)} className={`rounded-xl border p-4 hover:border-text ${selected === dateOnly(key) ? "border-text" : "border-line"}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-2xl" aria-hidden="true">📁</span><span className="text-xs text-text-soft">{items.length} პოსტი</span></div>
            <div className="mt-2 font-bold">{formatDate(key)} – {formatDate(key + 6 * DAY)}</div>
            <p className="mt-2 text-xs text-text-soft">{unresolved ? `${unresolved} პოსტს ჯერ დასრულებული სტატუსი არ აქვს` : "დასრულებული კვირა"}</p>
          </Link>
        })}
      </div>
      <nav className="mt-5 flex flex-wrap gap-4 text-sm font-bold" aria-label="Archive pagination">
        {page > 0 ? <Link href={`/admin/social/archive?page=${page - 1}`} className="underline">← უფრო ახალი</Link> : null}
        <Link href={`/admin/social/archive?page=${page + 1}`} className="underline">უფრო ძველი →</Link>
      </nav>
    </section>
    {selectedWeek ? <section aria-label="Selected campaign archive" className="ui-card p-5 sm:p-6">
      <h2 className="text-xl font-black">📂 {formatDate(selectedWeek[0])} – {formatDate(selectedWeek[0] + 6 * DAY)}</h2>
      <p className="mt-2 text-sm text-text-soft">საარქივო ჩანაწერების ნახვა · მხოლოდ კითხვა</p>
      <div className="mt-4 space-y-4">
        {selectedWeek[1].map(post => <article key={post.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm"><b>{formatTime(post.scheduledFor)}</b><span>· {post.pillar}</span><span className="rounded-full border px-2 py-1 text-xs">{post.status}</span><span className="text-xs text-text-soft">v{post.version} · {post.platforms.map(p => PLATFORM_LABEL[p]).join(" + ")}</span></div>
          <details className="mt-3"><summary className="cursor-pointer text-sm font-bold">პოსტი · სრული ტექსტი და ვიზუალი</summary>
            <div className="mt-3 whitespace-pre-wrap text-sm">{post.caption}</div>
            <div className="mt-3 flex flex-wrap gap-3">{post.contentType === "story" ? <StoryPreview post={post} /> : post.platforms.map(platform => <PlatformPreview key={platform} post={post} platform={platform} />)}</div>
          </details>
          <p className="mt-2 text-xs text-text-soft">QA: {post.qualityReport?.score ?? "—"}/100 · {post.qualityPassed ? "გავლილია" : "არ არის გავლილი"}</p>
        </article>)}
      </div>
      <details className="mt-6"><summary className="cursor-pointer font-bold">გამოქვეყნების ისტორია ({selectedJobs.length})</summary>
        <ul className="mt-3 space-y-2 text-sm">{selectedJobs.map(job => <li key={job.id} className="rounded-lg border p-3">{PLATFORM_LABEL[job.platform]} · {job.status} · {formatTime(job.scheduledAt)} · ცდა {job.attempt}/{job.maxAttempts} · External ID: {job.externalPostId ?? "—"} · შეცდომა: {job.lastErrorCode ?? "—"}</li>)}</ul>
      </details>
      <details className="mt-4"><summary className="cursor-pointer font-bold">შენახული მეტრიკები ({selectedMetrics.length})</summary>
        <p className="mt-2 text-xs text-text-soft">მხოლოდ ბაზაში არსებული მეტრიკები; ცარიელი სექცია არ ნიშნავს ნულოვან ჩართულობას.</p>
        <ul className="mt-3 space-y-2 text-sm">{selectedMetrics.map((m, i) => <li key={`${m.postId}-${m.platform}-${m.metricDate}-${i}`} className="rounded-lg border p-3">{PLATFORM_LABEL[m.platform]} · {m.metricDate} · Reach {m.reach} · Impressions {m.impressions} · Clicks {m.linkClicks} · Likes {m.likes} · Comments {m.comments} · Shares {m.shares} · Saves {m.saves}</li>)}</ul>
      </details>
    </section> : null}
  </main>
}
