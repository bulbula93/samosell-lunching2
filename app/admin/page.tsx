import { requireAdminUser } from "@/lib/auth"
import Link from "next/link"
import StatCard from "@/components/shared/StatCard"

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ flash?: string | string[] }> }) {
  const params = (await searchParams) ?? {}
  const flash = typeof params.flash === "string" ? params.flash : ""

  const { supabase } = await requireAdminUser("/dashboard")

  const [{ count: openReports }, { count: reviewingReports }, { count: suspendedUsers }, { count: activeListings }, { count: pendingBoosts }, { count: activeBoosts }] = await Promise.all([
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).in("status", ["pending_payment", "under_review", "approved"]),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }).eq("status", "active"),
  ])

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">ადმინისტრირება</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">ადმინისტრირების პანელი</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქედან აკონტროლებ რეპორტებს, პრობლემურ განცხადებებს, მომხმარებელთა შეზღუდვებს და VIP განთავსების მიმდინარე მოთხოვნებს.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/reports" className="ui-btn-primary">
              რეპორტების ნახვა
            </Link>
            <Link href="/admin/boosts" className="ui-btn-secondary">
              VIP განთავსების მართვა
            </Link>
          </div>
        </div>
      </section>

      {flash ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {flash}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="ღია რეპორტები" value={openReports ?? 0} />
        <StatCard label="დამუშავებაში" value={reviewingReports ?? 0} />
        <StatCard label="შეზღუდული მომხმარებლები" value={suspendedUsers ?? 0} />
        <StatCard label="აქტიური განცხადებები" value={activeListings ?? 0} />
        <StatCard label="მოლოდინში მყოფი მოთხოვნები" value={pendingBoosts ?? 0} />
        <StatCard label="აქტიური VIP" value={activeBoosts ?? 0} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="ui-card p-6">
          <div className="ui-eyebrow">მოდერაცია</div>
          <h2 className="mt-3 text-2xl font-black text-text">რაზე გაქვს ყველაზე მეტი კონტროლი</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-text-soft">
            <p>• ახალი და მიმდინარე რეპორტების სწრაფი განხილვა.</p>
            <p>• პრობლემური განცხადების დამალვა ან გამყიდველის შეზღუდვა.</p>
            <p>• უკვე შეზღუდული ანგარიშების აღდგენა საჭიროების შემთხვევაში.</p>
          </div>
        </div>

        <div className="ui-card p-6">
          <div className="ui-eyebrow">VIP განთავსება</div>
          <h2 className="mt-3 text-2xl font-black text-text">გადახდისა და boost მოთხოვნების კონტროლი</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-text-soft">
            <p>• TBC Checkout სტატუსის ხელით გადამოწმება callback-ის დაგვიანების შემთხვევაში.</p>
            <p>• მოთხოვნის გააქტიურება, უარყოფა ან reviewing რეჟიმში გადატანა.</p>
            <p>• მთავარ ბლოკში featured პოზიციის მინიჭება კონკრეტულ განცხადებაზე.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
