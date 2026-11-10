import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import { currentSocialRuntime } from "@/lib/social/runtime"
import { createSocialStore } from "@/lib/social/supabase-store"
import { assertTikTokActionAllowed, buildTikTokDraftWeek, georgianWeekStart } from "@/lib/tiktok/draft-agent"
import type { CandidateListing } from "@/lib/social/types"

export const dynamic = "force-dynamic"
export const metadata = { title: "TikTok Draft Agent | SamoSell", robots: { index: false, follow: false } }

const titles = {
  featured_listing: "დღის აღმოჩენა",
  how_to_sell: "რჩევა გამყიდველს",
  brand_awareness: "SamoSell-ის ცნობადობა",
}

export default async function TikTokDraftPreview() {
  await requireAdminUser("/dashboard")
  const env = process.env.VERCEL_ENV ?? (process.env.NODE_ENV === "development" ? "development" : "production")
  if (env !== "preview" && env !== "development") {
    return <main className="ui-container ui-section"><h1 className="text-2xl font-black">TikTok Draft Agent გამორთულია</h1><p className="mt-3 text-text-soft">ეს გვერდი მხოლოდ QA/Preview გარემოში მუშაობს.</p><Link href="/admin/social" className="underline">← AI მარკეტინგი</Link></main>
  }
  assertTikTokActionAllowed("generate_draft", env)
  const runtime = currentSocialRuntime()
  // This is a read-only presentation: no mutations, no external API, no renderer, no scheduling.
  const store = createSocialStore(runtime)
  let listings: CandidateListing[] = []
  let source = "QA სიიდან განცხადებები არ არის ხელმისაწვდომი — ნაჩვენებია მხოლოდ ზოგადი სცენარები."
  if (store) {
    try {
      listings = await store.listCandidateListings(40)
      source = "სცენარები აგებულია QA-ში ხელმისაწვდომი განცხადებების მიხედვით."
    } catch {
      source = "QA ბაზის წაკითხვა ვერ მოხერხდა — გამოყენებულია ზოგადი სცენარები."
    }
  }
  const weekStart = georgianWeekStart(new Date())
  const drafts = buildTikTokDraftWeek({ weekStart, listings })
  const format = (iso: string) => new Intl.DateTimeFormat("ka-GE", { timeZone: "Asia/Tbilisi", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))

  return <main className="ui-container ui-section space-y-6">
    <header className="ui-card p-6">
      <Link href="/admin/social" className="text-sm font-bold underline">← AI Marketing Control Center</Link>
      <div className="mt-4 text-xs font-bold uppercase tracking-wider text-text-soft">QA / Preview · ვიდეო დრაფტები</div>
      <h1 className="mt-2 text-3xl font-black">TikTok Draft Agent</h1>
      <p className="mt-3 text-sm text-text-soft">3 ვიდეო კვირაში · Mixed კონტენტი · 9:16 · 1080×1920 · 13 წამი · მხოლოდ სცენარი და რენდერის აღწერა</p>
      <div role="status" className="mt-4 rounded-xl border border-amber-500 p-4 text-sm">
        <strong>არაფერია გამოქვეყნებული ან ატვირთული.</strong> MP4 ფაილები ჯერ არ არის დარენდერებული. TikTok API, ავტოპუბლიკაცია, გადახდები და Production გამორთულია.
      </div>
      <p className="mt-3 text-xs text-text-soft">{source}</p>
    </header>
    <section aria-label="TikTok weekly draft plan" className="grid gap-4 lg:grid-cols-3">
      {drafts.map(draft => <article className="ui-card p-5" key={draft.key}>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="rounded-full border px-3 py-1 font-bold">Draft · Pending render</span>
          <span>{draft.qa.passed ? "QA: PASS" : "QA: BLOCKED"}</span>
        </div>
        <h2 className="mt-4 text-xl font-black">{titles[draft.topic]}</h2>
        <p className="mt-1 text-sm text-text-soft">{format(draft.scheduledFor)}</p>
        <div className="mt-4 space-y-3">
          {draft.frames.map(frame => <div key={frame.index} className="rounded-xl border p-3">
            <div className="text-xs text-text-soft">კადრი {frame.index} · {frame.durationSeconds} წმ.</div>
            <div className="mt-1 font-bold">{frame.heading}</div>
            <p className="mt-1 text-sm">{frame.detail}</p>
            <p className="mt-1 text-xs text-text-soft">ვიზუალი: {frame.imageUrl ? "დამტკიცებული SamoSell წყარო" : "ჯერ არ არის"}</p>
          </div>)}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm">{draft.caption}</p>
        {!draft.qa.passed && <p role="alert" className="mt-2 text-sm text-red-700">{draft.qa.errors.join(", ")}</p>}
        <p className="mt-3 break-all text-xs text-text-soft">ID: {draft.key}</p>
      </article>)}
    </section>
    <p className="text-xs text-text-soft">ეს არის გვერდის გახსნისას შექმნილი არაპერსისტენტული გეგმა. შემდეგ ეტაპზე საჭიროა ვიდეოს რეალური რენდერი, QA საცავი, ვერსიონირება და შენს მიერ დამტკიცების UI.</p>
  </main>
}
