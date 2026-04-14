import Link from "next/link"
import AdminReviewCard from "@/components/moderation/AdminReviewCard"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"
import type { AdminListingReport } from "@/types/moderation"

function flashLabel(value?: string) {
  switch (value) {
    case "resolved": return "რეპორტი მონიშნულია მოგვარებულად."
    case "dismissed": return "რეპორტი უარყოფილია."
    case "hide_listing": return "განცხადება დამალულია."
    case "suspend_seller": return "გამყიდველი შეიზღუდა და აქტიური განცხადებები დაარქივდა."
    case "restored": return "გამყიდველს შეზღუდვა მოეხსნა."
    default: return value || ""
  }
}

const tabs = [
  { key: "open", label: "ახალი" },
  { key: "reviewing", label: "მიმდინარე" },
  { key: "resolved", label: "დასრულებული" },
  { key: "all", label: "ყველა" },
] as const

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[]; flash?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const status = typeof params.status === "string" ? params.status : "open"
  const flashRaw = typeof params.flash === "string" ? params.flash : ""

  const { supabase } = await requireAdminUser("/dashboard")

  let query = supabase
    .from("admin_listing_reports")
    .select("id, listing_id, reporter_id, seller_id, reason, details, status, moderation_note, reviewed_by, reviewed_at, created_at, listing_slug, listing_title, listing_status, price, currency, cover_image_url, reporter_username, reporter_full_name, seller_username, seller_full_name, seller_is_suspended")
    .order("created_at", { ascending: false })

  if (status !== "all") query = query.eq("status", status)

  const [
    { data: reports },
    { count: openCount },
    { count: reviewingCount },
    { count: resolvedCount },
    { count: dismissedCount },
  ] = await Promise.all([
    query,
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "dismissed"),
  ])

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">მოდერაცია</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">რეპორტების დამუშავება</h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქედან ამოწმებ მომხმარებლების მიერ გამოგზავნილ სიგნალებს, იღებ გადაწყვეტილებას და საჭიროების შემთხვევაში ზღუდავ პრობლემურ ანგარიშებს.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin" className="ui-btn-secondary">
              ადმინისტრირების მთავარი
            </Link>
            <Link href="/admin/boosts" className="ui-btn-secondary">
              boost-ების მართვა
            </Link>
          </div>
        </div>
      </section>

      {flashRaw ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {flashLabel(flashRaw)}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ახალი რეპორტები" value={openCount ?? 0} />
        <StatCard label="მიმდინარე დამუშავება" value={reviewingCount ?? 0} />
        <StatCard label="მოგვარებული" value={resolvedCount ?? 0} />
        <StatCard label="უარყოფილი" value={dismissedCount ?? 0} />
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "open" ? "/admin/reports?status=open" : tab.key === "all" ? "/admin/reports?status=all" : `/admin/reports?status=${tab.key}`}
            className={status === tab.key ? "ui-pill-soft" : "ui-pill"}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <section className="mt-6 space-y-5">
        {reports && reports.length > 0 ? (
          (reports as AdminListingReport[]).map((item) => <AdminReviewCard key={item.id} item={item} />)
        ) : (
          <div className="ui-card border-dashed px-6 py-12 text-center text-sm text-text-soft">
            ამ ფილტრში რეპორტები არ მოიძებნა.
          </div>
        )}
      </section>
    </main>
  )
}
