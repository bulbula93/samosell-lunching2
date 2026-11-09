import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import { summarizeMetrics } from "@/lib/social/agents/analytics"
import { effectiveExecutionMode, currentSocialRuntime, SOCIAL_POLICY, type SocialRuntime } from "@/lib/social/runtime"
import { runSimulation } from "@/lib/social/simulation"
import { PLATFORM_LABEL } from "@/lib/social/store"
import { createSocialStore } from "@/lib/social/supabase-store"
import type { AdDraft, MetricRow, PublishJob, SocialControl, SocialPost, StoredAuditEntry } from "@/lib/social/types"
import { addStoryAction, approvePostAction, draftAdAction, editCaptionAction, enableInstagramAction, killSwitchAction, rejectPostAction, rerunQualityAction, runPlanningAction, runTickAction, settingsAction } from "./actions"
import { PlatformPreview, StoryPreview } from "./previews"

export const dynamic = "force-dynamic"
// Server actions on this page may convert a few images for Instagram (sharp); keep headroom.
export const maxDuration = 30
export const metadata = { title: "AI Marketing Control Center | SamoSell", robots: { index: false, follow: false } }

const STATUS_LABEL: Record<SocialPost["status"], string> = {
  draft: "დრაფტი", qa_failed: "QA ვერ გაიარა", ready_for_review: "ელოდება დამტკიცებას", approved: "დამტკიცებული",
  scheduled: "რიგშია", publishing: "ქვეყნდება", published: "გამოქვეყნდა", partially_published: "ნაწილობრივ", failed: "შეცდომა",
  rejected: "უარყოფილი", cancelled: "გაუქმებული",
}
const PILLAR_LABEL: Record<SocialPost["pillar"], string> = {
  featured_listing: "დღის ნივთი", giveaway: "გავაჩუქებ", how_to_sell: "რჩევა გამყიდველს", trust: "ნდობა / რატომ SamoSell", category_roundup: "კვირის რჩეულები",
}
const FLASH: Record<string, string> = {
  kill_switch_active: "Kill switch ჩართულია — აგენტები გაჩერებულია.", approval_missing: "საჭიროა ადმინის დამტკიცება.",
  quality_not_passed: "პოსტმა QA ვერ გაიარა.", post_not_reviewable: "პოსტი ამ ეტაპზე დასამტკიცებელი არ არის.",
  stale_version: "პოსტი შეიცვალა — განაახლე გვერდი.", approval_not_pending: "დამტკიცების მოთხოვნა აღარ არის აქტიური.",
  social_post_locked: "რიგში ჩამდგარი პოსტის რედაქტირება შეუძლებელია.", social_os_disabled: "Social OS ამ გარემოში გამორთულია.",
  qa_backend_not_allowed: "QA ბაზა ამ Preview-ზე არ არის დაკავშირებული.", preview_read_only: "Preview მხოლოდ სანახავადაა.",
  non_production_always_dry_run: "Preview-ზე მხოლოდ dry-run არის დაშვებული.", paid_ads_forbidden: "ფასიანი რეკლამა აკრძალულია.",
  instagram_media_prepared_qa_rerun: "სურათები მომზადდა Instagram-ისთვის — QA თავიდან გაეშვა, საჭიროა ხელახლა დამტკიცება.",
  instagram_disabled: "Instagram გამორთულია პარამეტრებში.", media_source_not_allowed: "სურათი SamoSell-ის Storage-დან არ არის.",
  media_source_unavailable: "სურათის ჩამოტვირთვა ვერ მოხერხდა.", media_not_image: "ფაილი სურათი არ არის.", media_too_large: "სურათი ძალიან დიდია.",
  media_convert_failed: "სურათის JPEG-ად გადაყვანა ვერ მოხერხდა.", media_upload_failed: "მომზადებული სურათის შენახვა ვერ მოხერხდა.",
  media_preparer_unavailable: "სურათის მომზადება ამ გარემოში მიუწვდომელია.",
  story_created_awaiting_approval: "Story შეიქმნა — გადახედე და დაამტკიცე.", stories_disabled: "Story-ები გამორთულია პარამეტრებში.",
  story_needs_listing_post: "Story მხოლოდ ნივთის პოსტს შეიძლება დაემატოს.", listing_unavailable: "ნივთი აღარ არის აქტიური.",
  story_render_failed: "Story-ს სურათის შექმნა ვერ მოხერხდა.", story_assets_missing: "Story-ს შრიფტი/ლოგო ვერ მოიძებნა სერვერზე.",
  kill_switch_engaged: "Kill switch ჩაირთო.", kill_switch_released: "Kill switch გამოირთო (dry-run რჩება).", settings_saved: "პარამეტრები შენახულია.",
  rejected: "პოსტი უარყოფილია.", caption_saved_qa_rerun: "ტექსტი შეინახა, QA ხელახლა შესრულდა.", qa_rerun: "QA ხელახლა შესრულდა.",
  ad_draft_created_zero_budget: "სარეკლამო იდეა შეიქმნა ($0, მხოლოდ დრაფტი).", invalid_input: "არასწორი მონაცემები.",
}
function flashText(code: string) {
  if (FLASH[code]) return FLASH[code]
  return code.replace(/_/g, " ")
}
const tbilisi = (iso: string) => new Intl.DateTimeFormat("ka-GE", { timeZone: "Asia/Tbilisi", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

function Badge({ tone, children }: { tone: "ok" | "warn" | "off" | "info"; children: React.ReactNode }) {
  const cls = { ok: "border-emerald-600 text-emerald-700", warn: "border-amber-500 text-amber-700", off: "border-red-500 text-red-700", info: "border-line text-text" }[tone]
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${cls}`}>{children}</span>
}

type Data = { control: SocialControl | null; posts: SocialPost[]; jobs: PublishJob[]; audit: StoredAuditEntry[]; ads: AdDraft[]; metrics: MetricRow[]; simulated: boolean; error: string | null }

async function load(runtime: SocialRuntime): Promise<Data> {
  const store = createSocialStore(runtime)
  if (!store) {
    const sim = await runSimulation()
    return { control: sim.control, posts: sim.posts, jobs: sim.jobs, audit: sim.audit, ads: [], metrics: [], simulated: true, error: null }
  }
  try {
    const now = Date.now()
    const [control, posts, jobs, audit, ads, metrics] = await Promise.all([
      store.getControl(),
      store.listPosts(new Date(now - 7 * 864e5).toISOString(), new Date(now + 21 * 864e5).toISOString(), 60),
      store.listJobs(30), store.listAudit(40), store.listAdDrafts(10),
      store.listMetrics(new Date(now - 30 * 864e5).toISOString().slice(0, 10)),
    ])
    return { control, posts, jobs, audit, ads, metrics, simulated: false, error: control ? null : "control_unavailable" }
  } catch {
    return { control: null, posts: [], jobs: [], audit: [], ads: [], metrics: [], simulated: false, error: "storage_unavailable" }
  }
}

export default async function SocialControlCenter({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdminUser("/dashboard")
  const params = await searchParams
  const runtime = currentSocialRuntime()
  const data = await load(runtime)
  const c = data.control
  const mode = c ? effectiveExecutionMode(runtime, c.executionMode) : "dry_run"
  const writable = !data.simulated && Boolean(c)
  const summary = summarizeMetrics(data.metrics, Object.fromEntries(data.posts.map(p => [p.id, p.pillar])))
  const byDay = new Map<string, SocialPost[]>()
  const storyByKey = new Map(data.posts.filter(p => p.contentType === "story").map(p => [p.idempotencyKey, p]))
  for (const p of data.posts) {
    const key = new Intl.DateTimeFormat("ka-GE", { timeZone: "Asia/Tbilisi", weekday: "long", day: "numeric", month: "long" }).format(new Date(p.scheduledFor))
    byDay.set(key, [...(byDay.get(key) ?? []), p])
  }
  const flash = params.ok ?? params.error
  const queuedJobs = data.jobs.filter(j => j.status === "queued")
  const problemJobs = data.jobs.filter(j => ["needs_review", "dead_letter", "failed"].includes(j.status))
  const upcoming = data.posts.filter(p => ["scheduled", "approved"].includes(p.status)).sort((a,b) => a.scheduledFor.localeCompare(b.scheduledFor))
  const publishedCount = data.posts.filter(p => p.status === "published").length


  return (
    <main className="ui-container ui-section space-y-6">
      <header className="ui-card p-6 sm:p-8">
        <div className="ui-eyebrow">SamoSell AI Operations / Social Media Agent OS v1.0</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-text">AI Marketing Control Center</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-text-soft">
          Strategy → Creative → Quality → ადმინის დამტკიცება → Publishing რიგი → Analytics. ყველა ნაბიჯი გადის Policy Gateway-ზე და იწერება აუდიტში.
          ფასიანი რეკლამა სრულად აკრძალულია; ბიუჯეტი $0.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="info">გარემო: {runtime.environment}</Badge>
          <Badge tone={c?.killSwitch === false ? "warn" : "off"}>Kill switch: {c ? (c.killSwitch ? "ჩართული (გაჩერებული)" : "გამორთული") : "უცნობი"}</Badge>
          <Badge tone={mode === "live" ? "warn" : "ok"}>რეჟიმი: {mode === "live" ? "LIVE" : "dry-run"}</Badge>
          <Badge tone={c?.instagramEnabled ? "ok" : "off"}>Instagram: {c?.instagramEnabled ? "ჩართული" : "გამორთული"}</Badge>
          <Badge tone={c?.facebookEnabled ? "ok" : "off"}>Facebook: {c?.facebookEnabled ? "ჩართული" : "გამორთული"}</Badge>
          <Badge tone="off">TikTok: გამორთული</Badge>
          <Badge tone="ok">Ads ბიუჯეტი: ${SOCIAL_POLICY.dailyAdsBudgetUsd}/დღე · ფასიანი: აკრძალული</Badge>
          <Badge tone={c?.organicAutoPublish ? "warn" : "ok"}>AI დამოუკიდებელი გამოქვეყნება: {c?.organicAutoPublish ? "ჩართული" : "გამორთული"}</Badge>
        </div>
        {data.simulated ? (
          <p role="status" className="mt-4 rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
            <b>სიმულაცია.</b> ბაზა ამ გარემოში დაკავშირებული არ არის ({runtime.backendReason}). ქვემოთ ნაჩვენებია რეალური აგენტების გაშვება მეხსიერებაში სატესტო ნივთებით — არაფერი ინახება და არაფერი ქვეყნდება.
          </p>
        ) : null}
        {data.error ? <p role="alert" className="mt-4 rounded-lg border border-red-500 bg-red-50 p-3 text-sm text-red-900">ბაზის მდგომარეობა ვერ წავიკითხე ({data.error}). სისტემა დახურულ რეჟიმშია.</p> : null}
        {flash ? <p role={params.error ? "alert" : "status"} className={`mt-4 rounded-lg border p-3 text-sm ${params.error ? "border-red-500 bg-red-50 text-red-900" : "border-emerald-600 bg-emerald-50 text-emerald-900"}`}>{flashText(flash)}</p> : null}
      </header>

      <nav aria-label="Social workspace" className="flex flex-wrap gap-2 rounded-xl border p-2 text-sm font-bold">
        <a className="rounded-lg px-4 py-2 hover:underline" href="#overview">მიმოხილვა</a>
        <a className="rounded-lg px-4 py-2 hover:underline" href="#content">კონტენტი</a>
        <a className="rounded-lg px-4 py-2 hover:underline" href="#publishing">გამოქვეყნება</a>
        <a className="rounded-lg px-4 py-2 hover:underline" href="#analytics">ანალიტიკა</a>
        <a className="rounded-lg px-4 py-2 hover:underline" href="#advanced">პარამეტრები</a>
      </nav>
      <section id="overview" aria-label="Overview" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="ui-card p-5"><p className="text-xs text-text-soft">შემდეგი გამოქვეყნება</p><p className="mt-2 text-lg font-black">{upcoming[0] ? tbilisi(upcoming[0].scheduledFor) : "არ არის"}</p></div>
        <div className="ui-card p-5"><p className="text-xs text-text-soft">რიგში</p><p className="mt-2 text-3xl font-black">{queuedJobs.length}</p></div>
        <div className="ui-card p-5"><p className="text-xs text-text-soft">საჭიროებს ყურადღებას</p><p className="mt-2 text-3xl font-black">{problemJobs.length}</p></div>
        <div className="ui-card p-5"><p className="text-xs text-text-soft">გამოქვეყნებული</p><p className="mt-2 text-3xl font-black">{publishedCount}</p><p className="text-xs text-text-soft">კალენდრის პერიოდში</p></div>
      </section>
      <p className="text-xs text-text-soft">AI-ის დამოუკიდებელი გამოქვეყნების გამორთვა არ აჩერებს უკვე დამტკიცებული პოსტების დაგეგმილ გამოქვეყნებას. სრული გაჩერებისთვის გამოიყენე Kill switch.</p>
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Controls">
        <div className="ui-card p-5">
          <h2 className="text-lg font-bold text-text">Kill switch</h2>
          <p className="mt-1 text-sm text-text-soft">აჩერებს დაგეგმვას, დრაფტებს, რიგს და გამოქვეყნებას. მიმდინარე რიგი რჩება შენახული.</p>
          <form action={killSwitchAction} className="mt-4">
            <input type="hidden" name="engage" value={c?.killSwitch ? "false" : "true"} />
            <button disabled={!writable} className={`w-full rounded-full px-4 py-3 text-sm font-black text-white disabled:opacity-40 ${c?.killSwitch ? "bg-emerald-700" : "bg-red-600"}`}>
              {c?.killSwitch ? "აგენტების გაშვება (dry-run)" : "🛑 ყველაფრის გაჩერება"}
            </button>
          </form>
        </div>
        <details id="advanced" className="ui-card p-5">
          <summary className="cursor-pointer text-lg font-bold text-text">პარამეტრები · გაფართოებული</summary>
          <form action={settingsAction} className="mt-3 space-y-2 text-sm text-text">
            <label className="flex items-center gap-2"><input type="checkbox" name="instagram" defaultChecked={c?.instagramEnabled} disabled={!writable} /> Instagram</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="facebook" defaultChecked={c?.facebookEnabled} disabled={!writable} /> Facebook</label>
            <label className="flex items-center gap-2 text-text-soft"><input type="checkbox" disabled /> TikTok (პოლიტიკით აკრძალული)</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="autoPublish" defaultChecked={c?.organicAutoPublish} disabled={!writable} /> ორგანული ავტო-გამოქვეყნება (QA-ს შემდეგ, დამტკიცების გარეშე)</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="stories" defaultChecked={c?.storiesEnabled} disabled={!writable} /> 🎬 ნივთის პოსტს Story-ც დაემატოს (1 საათით გვიან, იგივე დამტკიცებით)</label>
            <label className="flex items-center gap-2">რეჟიმი
              <select name="executionMode" defaultValue={c?.executionMode ?? "dry_run"} disabled={!writable} className="rounded border px-2 py-1">
                <option value="dry_run">dry-run</option>
                <option value="live" disabled={runtime.executionModeCeiling !== "live"}>live {runtime.executionModeCeiling !== "live" ? "(დაბლოკილი)" : ""}</option>
              </select>
            </label>
            <button disabled={!writable} className="mt-2 rounded-full border px-4 py-2 font-bold disabled:opacity-40">შენახვა</button>
          </form>
        </details>
        <div className="ui-card p-5">
          <h2 className="text-lg font-bold text-text">აგენტები</h2>
          <p className="mt-1 text-sm text-text-soft">შემდეგი კვირის გეგმა (5 პოსტი) აქტიური ნივთებიდან. განმეორებით გაშვება დუბლიკატს არ ქმნის.</p>
          <form action={runPlanningAction} className="mt-3"><button disabled={!writable} className="w-full rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">📅 კვირის გეგმის შექმნა</button></form>

          <p className="mt-2 text-xs text-text-soft">Live: {runtime.liveReason}</p>
        </div>
      </section>

      <section id="content" className="ui-card p-5 sm:p-6" aria-label="Content calendar">
        <h2 className="text-xl font-bold text-text">კონტენტის კალენდარი და დრაფტები</h2>
        {data.posts.length === 0 ? <p className="mt-3 text-sm text-text-soft">დაგეგმილი პოსტი ჯერ არ არის.</p> : null}
        <div className="mt-4 space-y-6">
          {[...byDay.entries()].filter(([, posts]) => posts.some(p => !["rejected", "cancelled"].includes(p.status))).map(([day, posts]) => (
            <div key={day}>
              <h3 className="text-sm font-black uppercase tracking-wide text-text-soft">{day}</h3>
              <div className="mt-2 space-y-4">
                {posts.filter(p => !["rejected", "cancelled"].includes(p.status)).map(post => {
                  const errors = post.qualityReport?.issues.filter(i => i.severity === "error") ?? []
                  const warnings = post.qualityReport?.issues.filter(i => i.severity === "warning") ?? []
                  return (
                    <article key={post.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone="info">{tbilisi(post.scheduledFor)}</Badge>
                        <Badge tone="info">{PILLAR_LABEL[post.pillar]}</Badge>
                        <Badge tone={post.status === "qa_failed" || post.status === "failed" ? "off" : post.status === "ready_for_review" ? "warn" : "ok"}>{STATUS_LABEL[post.status]}</Badge>
                        {post.contentType === "story" ? <Badge tone="info">🎬 Story</Badge> : null}
                        <span className="text-text-soft">v{post.version} · QA {post.qualityReport ? `${post.qualityReport.score}/100` : "—"} · {post.platforms.map(p => PLATFORM_LABEL[p]).join(" + ")}</span>
                      </div>
                      <details className="mt-3"><summary className="cursor-pointer text-sm font-bold">პრევიუ და სრული ტექსტი</summary><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        {post.contentType === "story" ? <StoryPreview post={post} /> : post.platforms.map(p => <PlatformPreview key={p} post={post} platform={p} />)}
                      </div></details>
                      {errors.length + warnings.length > 0 ? (
                        <ul className="mt-3 space-y-1 text-sm">
                          {errors.map(i => <li key={i.code + (i.platform ?? "")} className="text-red-700">⛔ {i.message}</li>)}
                          {warnings.map(i => <li key={i.code + (i.platform ?? "")} className="text-amber-700">⚠️ {i.message}</li>)}
                        </ul>
                      ) : null}
                      {writable ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {post.status === "ready_for_review" ? (
                            <form action={approvePostAction}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="version" value={post.version} />
                              <button className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white">✅ დამტკიცება და რიგში ჩაყენება ({mode}){storyByKey.get(`${post.idempotencyKey}:story`)?.status === "ready_for_review" ? " + Story" : ""}</button></form>
                          ) : null}
                          {post.status === "ready_for_review" ? (
                            <form action={rejectPostAction}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="version" value={post.version} />
                              <button className="rounded-full border px-4 py-2 text-sm font-bold">უარყოფა</button></form>
                          ) : null}
                          {c?.storiesEnabled && post.listingId && post.contentType !== "story" && !storyByKey.has(`${post.idempotencyKey}:story`) && !["rejected", "cancelled", "failed"].includes(post.status) ? (
                            <form action={addStoryAction}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="version" value={post.version} />
                              <button className="rounded-full border border-violet-600 px-4 py-2 text-sm font-bold text-violet-700">🎬 Story-ც</button></form>
                          ) : null}
                          {c?.instagramEnabled && post.contentType !== "story" && !post.platforms.includes("instagram") && ["draft", "qa_failed", "ready_for_review"].includes(post.status) ? (
                            <form action={enableInstagramAction}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="version" value={post.version} />
                              <button className="rounded-full border border-pink-600 px-4 py-2 text-sm font-bold text-pink-700">📸 Instagram-ზეც</button></form>
                          ) : null}
                          {["draft", "qa_failed"].includes(post.status) ? (
                            <form action={rerunQualityAction}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="version" value={post.version} />
                              <button className="rounded-full border px-4 py-2 text-sm font-bold">QA ხელახლა</button></form>
                          ) : null}
                          <form action={draftAdAction}><input type="hidden" name="postId" value={post.id} /><input type="hidden" name="version" value={post.version} />
                            <button className="rounded-full border px-4 py-2 text-sm text-text-soft">სარეკლამო იდეა ($0 დრაფტი)</button></form>
                        </div>
                      ) : null}
                      {writable && ["draft", "qa_failed", "ready_for_review", "approved", "rejected"].includes(post.status) ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-bold text-text">ტექსტის რედაქტირება</summary>
                          <form action={editCaptionAction} className="mt-2 space-y-2">
                            <input type="hidden" name="postId" value={post.id} /><input type="hidden" name="version" value={post.version} />
                            <textarea name="caption" defaultValue={post.caption} maxLength={2200} rows={8} className="w-full rounded-lg border p-2 text-sm" />
                            <p className="text-xs text-text-soft">შენახვა ქმნის ახალ ვერსიას: QA თავიდან ეშვება და ძველი დამტკიცება უქმდება.</p>
                            <button className="rounded-full border px-4 py-2 text-sm font-bold">შენახვა</button>
                          </form>
                        </details>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="publishing" className="ui-card p-5 sm:p-6" aria-label="Publishing queue">
        <h2 className="text-xl font-bold text-text">Publishing რიგი</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-text-soft"><tr><th className="py-2">პლატფორმა</th><th>რეჟიმი</th><th>სტატუსი</th><th>ცდა</th><th>დრო</th><th>External ID</th><th>შეცდომა</th></tr></thead>
            <tbody>
              {data.jobs.length === 0 ? <tr><td colSpan={7} className="py-3 text-text-soft">რიგი ცარიელია.</td></tr> : data.jobs.map(j => (
                <tr key={j.id} className="border-t">
                  <td className="py-2">{PLATFORM_LABEL[j.platform]}</td><td>{j.executionMode}</td><td className={j.status === "needs_review" || j.status === "dead_letter" ? "font-bold text-red-700" : ""}>{j.status}</td>
                  <td>{j.attempt}/{j.maxAttempts}</td><td>{tbilisi(j.scheduledAt)}</td><td className="font-mono text-xs">{j.externalPostId ?? "—"}</td><td className="text-xs">{j.lastErrorCode ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-text-soft"><b>needs_review</b> = შედეგი უცნობია (შეიძლება უკვე გამოქვეყნდა). ავტომატურად აღარ იგზავნება — შეამოწმე Page ხელით.</p>
      </section>

      <section id="analytics" className="grid gap-4 lg:grid-cols-2">
        <div className="ui-card p-5 sm:p-6" aria-label="Metrics">
          <h2 className="text-xl font-bold text-text">შედეგები (30 დღე)</h2>
          {data.metrics.length === 0 ? <p className="mt-2 text-sm text-text-soft">მეტრიკა ჯერ არ არის. Insights-ის სინქრონიზაცია ჩაირთვება live გაშვების შემდეგ.</p> : (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-text-soft">Reach</dt><dd className="text-2xl font-black">{summary.totalReach}</dd></div>
              <div><dt className="text-text-soft">ჩართულობა</dt><dd className="text-2xl font-black">{(summary.avgEngagementRate * 100).toFixed(1)}%</dd></div>
              <div><dt className="text-text-soft">საუკეთესო თემა</dt><dd className="font-bold">{summary.bestPillar ? PILLAR_LABEL[summary.bestPillar] : "—"}</dd></div>
            </dl>
          )}
          <h3 className="mt-5 text-sm font-bold text-text">Ads Planner (მხოლოდ დრაფტი, $0)</h3>
          {data.ads.length === 0 ? <p className="mt-1 text-sm text-text-soft">იდეები არ არის.</p> : <ul className="mt-1 space-y-1 text-sm">{data.ads.map(a => <li key={a.id}>• {a.title} <span className="text-text-soft">({a.objective}, ${a.dailyBudgetUsd})</span></li>)}</ul>}
        </div>
        <details className="ui-card p-5 sm:p-6" aria-label="Audit log">
          <summary className="cursor-pointer text-xl font-bold text-text">აუდიტი და ტექნიკური დიაგნოსტიკა</summary>
          <form action={runTickAction} className="mt-4"><button disabled={!writable} className="rounded-full border border-amber-600 px-4 py-2 text-sm font-bold disabled:opacity-40">Publishing worker (1 ციკლი)</button></form>
          <p className="mt-2 text-xs text-text-soft">LIVE რეჟიმში worker-ის გაშვებამ შეიძლება პოსტი რეალურად გამოაქვეყნოს.</p>
          <ol className="mt-3 max-h-96 space-y-1 overflow-y-auto font-mono text-xs">
            {data.audit.length === 0 ? <li className="text-text-soft">ჩანაწერი არ არის.</li> : data.audit.map(a => (
              <li key={a.id} className="break-words"><span className="text-text-soft">{tbilisi(a.occurredAt)}</span> {a.actorType}:{a.actorType === "human" ? "admin" : a.actor} <b>{a.action}</b> → <span className={a.decision === "deny" || a.decision === "failure" ? "text-red-700" : ""}>{a.decision}</span> ({a.reason})</li>
            ))}
          </ol>
        </details>
      </section>

      <div className="flex flex-wrap gap-4 text-sm font-bold">
        <Link href="/admin/ai" className="underline">← AI Operations</Link>
        <Link href="/admin" className="underline">ადმინისტრირების პანელი</Link>
      </div>
    </main>
  )
}
