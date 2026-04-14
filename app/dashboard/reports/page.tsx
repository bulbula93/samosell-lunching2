import Link from "next/link"
import StatCard from "@/components/shared/StatCard"
import { createClient } from "@/lib/supabase/server"
import type { UserListingReport } from "@/types/moderation"

function reportStatusLabel(value: string) {
  switch (value) {
    case "open": return "ღია"
    case "reviewing": return "მიმდინარე"
    case "resolved": return "მოგვარებული"
    case "dismissed": return "უარყოფილი"
    default: return value
  }
}

function reportReasonLabel(value: string) {
  switch (value) {
    case "spam": return "სპამი"
    case "fake": return "ყალბი განცხადება"
    case "prohibited": return "აკრძალული ნივთი"
    case "abuse": return "შეურაცხმყოფელი შინაარსი"
    case "wrong_info": return "არასწორი ინფორმაცია"
    case "other": return "სხვა"
    default: return value
  }
}

export default async function DashboardReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: reports },
    { count: openCount },
    { count: reviewingCount },
    { count: resolvedCount },
  ] = await Promise.all([
    supabase
      .from("listing_reports")
      .select("id, reason, details, status, moderation_note, created_at, listing:listings(slug, title)")
      .eq("reporter_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("reporter_id", user!.id).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("reporter_id", user!.id).eq("status", "reviewing"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("reporter_id", user!.id).eq("status", "resolved"),
  ])

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="ui-eyebrow">უსაფრთხოება</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">ჩემი რეპორტები</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქ ნახავ შენს მიერ გაგზავნილ რეპორტებს, მათ სტატუსს და მოდერატორის პასუხებს, თუ შენიშვნა დატოვეს.
            </p>
          </div>
          <Link href="/catalog" className="ui-btn-secondary">
            კატალოგში დაბრუნება
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="ახალი" value={openCount ?? 0} />
        <StatCard label="მიმდინარე" value={reviewingCount ?? 0} />
        <StatCard label="მოგვარებული" value={resolvedCount ?? 0} />
      </section>

      <section className="mt-6 space-y-4">
        {reports && reports.length > 0 ? (
          (reports as unknown as UserListingReport[]).map((item) => (
            <article key={item.id} className="ui-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="ui-eyebrow">რეპორტი</div>
                  <h2 className="mt-2 text-2xl font-black text-text">{item.listing?.title || "განცხადება"}</h2>
                  {item.listing?.slug ? (
                    <Link href={`/listing/${item.listing.slug}`} className="mt-3 inline-flex text-sm font-semibold text-brand underline underline-offset-4">
                      განცხადების გახსნა
                    </Link>
                  ) : null}
                </div>
                <span className="ui-pill">{reportStatusLabel(item.status)}</span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                  <div className="font-semibold text-text">მიზეზი</div>
                  <div className="mt-1">{reportReasonLabel(item.reason)}</div>
                </div>
                <div className="rounded-[1.2rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                  <div className="font-semibold text-text">გაგზავნის დრო</div>
                  <div className="mt-1">{new Date(item.created_at).toLocaleString("ka-GE")}</div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-line bg-surface-alt px-4 py-3 text-sm leading-7 text-text-soft">
                {item.details || "დეტალები არ არის მითითებული."}
              </div>

              {item.moderation_note ? (
                <div className="mt-3 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                  მოდერატორის შენიშვნა: {item.moderation_note}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="ui-card border-dashed px-6 py-12 text-center text-sm text-text-soft">
            ჯერ არცერთი რეპორტი არ გაგიგზავნია.
          </div>
        )}
      </section>
    </main>
  )
}
