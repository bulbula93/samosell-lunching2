import Link from "next/link"
import StatCard from "@/components/shared/StatCard"
import { requireAuthenticatedUser } from "@/lib/auth"
import { reportReasonLabel, reportStatusLabel } from "@/lib/moderation"

type DashboardReport = {
  kind: "listing" | "user"
  id: string
  reason: string
  details: string | null
  status: string
  moderation_note: string | null
  created_at: string
  title: string
  href: string | null
}

export default async function DashboardReportsPage() {
  const { supabase, user } = await requireAuthenticatedUser("/dashboard/reports")

  const [
    listingReportsResponse,
    userReportsResponse,
    listingOpen,
    listingReviewing,
    listingResolved,
    userOpen,
    userReviewing,
    userResolved,
  ] = await Promise.all([
    supabase
      .from("listing_reports")
      .select(
        "id, reason, details, status, moderation_note, created_at, listing:listings(slug, title)",
      )
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_reports")
      .select(
        "id, reason, details, status, moderation_note, created_at, reported_user:profiles!user_reports_reported_user_id_fkey(username, full_name), context_listing:listings!user_reports_context_listing_id_fkey(slug, title)",
      )
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", user.id)
      .eq("status", "open"),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", user.id)
      .eq("status", "reviewing"),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", user.id)
      .eq("status", "resolved"),
    supabase
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", user.id)
      .eq("status", "open"),
    supabase
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", user.id)
      .eq("status", "reviewing"),
    supabase
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", user.id)
      .eq("status", "resolved"),
  ])

  const listingReports = (listingReportsResponse.data ?? []).map((item) => {
    const listing = Array.isArray(item.listing) ? item.listing[0] : item.listing
    return {
      kind: "listing" as const,
      id: item.id,
      reason: item.reason,
      details: item.details,
      status: item.status,
      moderation_note: item.moderation_note,
      created_at: item.created_at,
      title: listing?.title || "განცხადება",
      href: listing?.slug ? `/listing/${listing.slug}` : null,
    }
  })

  const userReports = (userReportsResponse.data ?? []).map((item) => {
    const reportedUser = Array.isArray(item.reported_user)
      ? item.reported_user[0]
      : item.reported_user
    const contextListing = Array.isArray(item.context_listing)
      ? item.context_listing[0]
      : item.context_listing
    return {
      kind: "user" as const,
      id: item.id,
      reason: item.reason,
      details: item.details,
      status: item.status,
      moderation_note: item.moderation_note,
      created_at: item.created_at,
      title:
        reportedUser?.full_name ||
        reportedUser?.username ||
        "მომხმარებლის ანგარიში",
      href: contextListing?.slug
        ? `/listing/${contextListing.slug}`
        : reportedUser?.username
          ? `/seller/${encodeURIComponent(reportedUser.username)}`
          : null,
    }
  })

  const reports: DashboardReport[] = [...listingReports, ...userReports].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  )
  const reportsError =
    listingReportsResponse.error ||
    userReportsResponse.error ||
    listingOpen.error ||
    listingReviewing.error ||
    listingResolved.error ||
    userOpen.error ||
    userReviewing.error ||
    userResolved.error

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="ui-eyebrow">უსაფრთხოება</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              ჩემი რეპორტები
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              აქ ჩანს შენს მიერ გამოგზავნილი განცხადებისა და მომხმარებლის
              რეპორტები, მათი სტატუსი და მოდერატორის პასუხი.
            </p>
          </div>
          <Link href="/catalog" className="ui-btn-secondary">
            კატალოგში დაბრუნება
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard
          label="ახალი"
          value={(listingOpen.count ?? 0) + (userOpen.count ?? 0)}
        />
        <StatCard
          label="მიმდინარე"
          value={(listingReviewing.count ?? 0) + (userReviewing.count ?? 0)}
        />
        <StatCard
          label="მოგვარებული"
          value={(listingResolved.count ?? 0) + (userResolved.count ?? 0)}
        />
      </section>

      {reportsError ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          რეპორტების ჩატვირთვა ვერ მოხერხდა. განაახლე გვერდი და სცადე ხელახლა.
        </div>
      ) : null}

      <section className="mt-6 space-y-4">
        {!reportsError && reports.length > 0 ? (
          reports.map((item) => (
            <article key={`${item.kind}-${item.id}`} className="ui-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="ui-eyebrow">
                    {item.kind === "listing"
                      ? "განცხადების რეპორტი"
                      : "მომხმარებლის რეპორტი"}
                  </div>
                  <h2 className="mt-2 break-words text-2xl font-black text-text">
                    {item.title}
                  </h2>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4"
                    >
                      კონტექსტის გახსნა
                    </Link>
                  ) : null}
                </div>
                <span className="ui-pill">
                  {reportStatusLabel(item.status)}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-text-soft">
                  <dt className="font-semibold text-text">მიზეზი</dt>
                  <dd className="mt-1">
                    {reportReasonLabel(item.kind, item.reason)}
                  </dd>
                </div>
                <div className="rounded-xl bg-surface-alt px-4 py-3 text-sm text-text-soft">
                  <dt className="font-semibold text-text">გაგზავნის დრო</dt>
                  <dd className="mt-1">
                    {new Date(item.created_at).toLocaleString("ka-GE")}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-line bg-surface-alt px-4 py-3 text-sm leading-7 text-text-soft [overflow-wrap:anywhere]">
                {item.details || "დეტალები არ არის მითითებული."}
              </div>

              {item.moderation_note ? (
                <div className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900 [overflow-wrap:anywhere]">
                  მოდერატორის შენიშვნა: {item.moderation_note}
                </div>
              ) : null}
            </article>
          ))
        ) : !reportsError ? (
          <div className="ui-card border-dashed px-6 py-12 text-center text-sm text-text-soft">
            ჯერ არცერთი რეპორტი არ გაგიგზავნია.
          </div>
        ) : null}
      </section>
    </main>
  )
}
