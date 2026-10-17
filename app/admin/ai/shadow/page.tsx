import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import { isShadowEnabled, triageShadowCounts, type ShadowCounts } from "@/lib/ai-ops/shadow"

export const dynamic = "force-dynamic"
export const metadata = { title: "AI Shadow Monitor | SamoSell", robots: { index: false, follow: false } }

export default async function ShadowMonitorPage() {
  const { supabase } = await requireAdminUser("/dashboard")
  const enabled = isShadowEnabled(process.env)
  let counts: ShadowCounts = { moderationOpen: null, supportOpen: null, paymentsPending: null }
  if (enabled) {
    // Aggregate-only, limited to current user's already-authorized Supabase session.
    // Fail closed on query errors rather than reporting a misleading zero.
    const [moderation, support, payments] = await Promise.all([
      supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("flitt_payment_attempts").select("id", { count: "exact", head: true }).eq("status", "pending").eq("mode", "live"),
    ])
    counts = {
      moderationOpen: moderation.error ? null : moderation.count,
      supportOpen: support.error ? null : support.count,
      paymentsPending: payments.error ? null : payments.count,
    }
  }
  const signals = enabled ? triageShadowCounts(counts) : []
  return (
    <main className="ui-container ui-section space-y-6">
      <header className="ui-card p-6">
        <div className="ui-eyebrow">AI Operations / Shadow Monitor</div>
        <h1 className="mt-3 text-3xl font-black text-text">დაკვირვების რეჟიმი</h1>
        <p className="mt-3 text-sm text-text-soft">ეს პანელი მხოლოდ ითვლის მოვლენებს. AI მოდელები, Worker, Scheduler, შეტყობინებების გაგზავნა და მონაცემების შეცვლა არ არის ჩართული.</p>
        <p className="mt-3 text-sm font-bold text-text">სტატუსი: {enabled ? "ჩართულია (მხოლოდ წაკითხვა)" : "გამორთულია"}</p>
        <p className="mt-2 text-xs text-text-soft">ჩართვისთვის Preview გარემოში: AI_OPS_SHADOW_ENABLED=true. გადაუდებელი გამორთვა: AI_OPS_KILL_SWITCH=true. Production-ში ამ გვერდის სკანირება ყოველთვის გამორთულია.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        {([
          ["მოდერაციის მოთხოვნები", counts.moderationOpen],
          ["Support მოთხოვნები", counts.supportOpen],
          ["Pending გადახდები", counts.paymentsPending],
        ] as const).map(([name, count]) => (
          <article key={name} className="ui-card p-5">
            <h2 className="text-sm font-bold text-text">{name}</h2>
            <p className="mt-3 text-3xl font-black text-text">{count === null ? "—" : count}</p>
            <p className="text-xs text-text-soft">{count === null ? "მონაცემები მიუწვდომელია ან სკანირება გამორთულია" : "მხოლოდ აგრეგირებული მონაცემი"}</p>
          </article>
        ))}
      </section>
      <section className="ui-card p-6">
        <h2 className="text-xl font-bold text-text">სიგნალები — წესებზე დაფუძნებული ტრიაჟი</h2>
        {signals.length === 0 ? <p className="mt-3 text-sm text-text-soft">აქტიური სიგნალი არ არის, ან შემოწმება გამორთულია.</p> : (
          <ul className="mt-3 space-y-3">{signals.map((signal) => (
            <li className="rounded-lg border p-3" key={signal.id}>
              <p className="font-bold text-text">{signal.summary} — {signal.count}</p>
              <p className="text-xs text-text-soft">{signal.role} · {signal.priority} · მოქმედება არ შესრულებულა</p>
            </li>
          ))}</ul>
        )}
      </section>
      <Link href="/admin/ai" className="text-sm font-bold underline">← AI მართვის პანელი</Link>
    </main>
  )
}
