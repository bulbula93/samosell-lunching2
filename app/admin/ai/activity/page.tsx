import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const metadata = { title: "AI Activity | SamoSell", robots: { index: false, follow: false } }

export default async function AiActivityPage() {
  const { supabase } = await requireAdminUser("/dashboard")
  // RLS is admin-only; database migration is intentionally not applied yet.
  // Missing schema is an explicit "not installed" state, never displayed as zero activity.
  const [jobs, activity, control, approvals] = await Promise.all([
    supabase.from("ai_ops_jobs").select("id,role,kind,status,priority,attempt,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("ai_ops_activity").select("id,role,event_type,created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("ai_ops_control").select("stopped").eq("singleton", true).maybeSingle(),
    supabase.from("ai_ops_approvals").select("id,action,status,requested_at").eq("status", "pending").limit(10),
  ])
  const installed = !jobs.error && !activity.error && !control.error && !approvals.error && control.data !== null
  return (
    <main className="ui-container ui-section space-y-5">
      <header className="ui-card p-6">
        <div className="ui-eyebrow">AI Operations / Job Queue</div>
        <h1 className="mt-3 text-3xl font-black text-text">დავალებები და აქტივობის ჟურნალი</h1>
        <p className="mt-2 text-sm text-text-soft">მხოლოდ წაკითხვა. ამ გვერდიდან აგენტები არ ირთვება და არც დავალებები სრულდება.</p>
        <p className="mt-3 font-bold text-text">{!installed ? "ბაზის სქემა ჯერ არ არის დაყენებული ან მიუწვდომელია" : control.data?.stopped ? "Kill Switch: შეჩერებულია" : "Kill Switch: სქემის მიხედვით ჩართულია; Worker ჯერ არ არსებობს"}</p>
      </header>
      {!installed ? (
        <section role="status" className="ui-card p-6">
          <h2 className="font-bold text-text">საჭიროა იზოლირებული Preview მონაცემთა ბაზა</h2>
          <p className="mt-2 text-sm text-text-soft">მიგრაცია რეპოზიტორში მომზადებულია, მაგრამ არც ერთ Supabase პროექტზე ავტომატურად არ გაშვებულა. მონაცემებსა და სტატუსებს არ ვიგონებთ.</p>
        </section>
      ) : (
        <>
          <section className="ui-card p-6">
            <h2 className="text-xl font-bold text-text">Job Queue — ბოლო 20</h2>
            {(jobs.data ?? []).length === 0 ? <p className="mt-3 text-sm text-text-soft">დავალებები ჯერ არ არსებობს.</p> :
              <ul className="mt-3 space-y-2">{(jobs.data ?? []).map(j => <li key={j.id} className="rounded-lg border p-3 text-sm"><span className="font-bold">{j.role}</span> · {j.kind} · {j.status} · {j.priority} · attempt {j.attempt}</li>)}</ul>}
          </section>
          <section className="ui-card p-6">
            <h2 className="text-xl font-bold text-text">Activity Log — ბოლო 30</h2>
            {(activity.data ?? []).length === 0 ? <p className="mt-3 text-sm text-text-soft">მოქმედებები ჯერ არ დაფიქსირებულა.</p> :
              <ul className="mt-3 space-y-2">{(activity.data ?? []).map(e => <li key={e.id} className="rounded-lg border p-3 text-sm">{e.created_at} · {e.role} · {e.event_type}</li>)}</ul>}
          </section>
          <section className="ui-card p-6">
            <h2 className="text-xl font-bold text-text">Approval Center — წასაკითხი რიგი</h2>
            <p className="mt-2 text-sm text-text-soft">{(approvals.data ?? []).length} pending მოთხოვნა. დამტკიცების ოპერაციები ჯერ გამორთულია.</p>
          </section>
        </>
      )}
      <Link className="text-sm font-bold underline" href="/admin/ai">← AI მართვის პანელი</Link>
    </main>
  )
}
