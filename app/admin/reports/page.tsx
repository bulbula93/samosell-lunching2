import Link from "next/link"
import AdminReviewCard from "@/components/moderation/AdminReviewCard"
import AdminUserReviewCard from "@/components/moderation/AdminUserReviewCard"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"
import { isReportStatus } from "@/lib/moderation"
import type {
  AdminListingReport,
  AdminUserReport,
  ModerationAuditEntry,
} from "@/types/moderation"

const PAGE_SIZE = 30

function flashLabel(value?: string) {
  switch (value) {
    case "reviewing":
      return "რეპორტი გადავიდა განხილვაში."
    case "resolved":
      return "რეპორტი მონიშნულია მოგვარებულად."
    case "dismissed":
      return "რეპორტი უარყოფილია."
    case "hide_listing":
      return "განცხადება დამალულია."
    case "suspend_user":
      return "მომხმარებელი შეიზღუდა და მისი აქტიური განცხადებები დაარქივდა."
    case "restored":
      return "მომხმარებელს შეზღუდვა მოეხსნა."
    default:
      return value || ""
  }
}

function auditActionLabel(value: string) {
  switch (value) {
    case "mark_reviewing":
      return "განხილვაში გადაყვანა"
    case "resolve":
      return "მოგვარება"
    case "dismiss":
      return "უარყოფა"
    case "hide_listing":
      return "განცხადების დამალვა"
    case "suspend_user":
      return "მომხმარებლის შეზღუდვა"
    case "restore_user":
      return "მომხმარებლის აღდგენა"
    default:
      return value
  }
}

const statusTabs = [
  { key: "open", label: "ახალი" },
  { key: "reviewing", label: "მიმდინარე" },
  { key: "resolved", label: "დასრულებული" },
  { key: "dismissed", label: "უარყოფილი" },
  { key: "all", label: "ყველა" },
] as const

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string | string[]
    kind?: string | string[]
    flash?: string | string[]
  }>
}) {
  const params = (await searchParams) ?? {}
  const requestedStatus =
    typeof params.status === "string" ? params.status : "open"
  const status =
    requestedStatus === "all" || isReportStatus(requestedStatus)
      ? requestedStatus
      : "open"
  const kind = params.kind === "user" ? "user" : "listing"
  const flashRaw = typeof params.flash === "string" ? params.flash : ""
  const { supabase } = await requireAdminUser("/dashboard")

  let reportsQuery =
    kind === "listing"
      ? supabase
          .from("admin_listing_reports")
          .select(
            "id, listing_id, reporter_id, seller_id, reason, details, status, moderation_note, reviewed_by, reviewed_at, created_at, updated_at, listing_slug, listing_title, listing_status, price, currency, cover_image_url, reporter_username, reporter_full_name, seller_username, seller_full_name, seller_is_suspended",
          )
      : supabase
          .from("admin_user_reports")
          .select(
            "id, reporter_id, reported_user_id, context_listing_id, reason, details, status, moderation_note, reviewed_by, reviewed_at, created_at, updated_at, reporter_username, reporter_full_name, reported_username, reported_full_name, reported_avatar_url, reported_is_suspended, context_listing_slug, context_listing_title, context_listing_status",
          )

  reportsQuery = reportsQuery
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)

  if (status !== "all") reportsQuery = reportsQuery.eq("status", status)

  const [
    reportsResponse,
    listingOpen,
    listingReviewing,
    listingResolved,
    listingDismissed,
    userOpen,
    userReviewing,
    userResolved,
    userDismissed,
    auditResponse,
  ] = await Promise.all([
    reportsQuery,
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "reviewing"),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved"),
    supabase
      .from("listing_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "dismissed"),
    supabase
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "reviewing"),
    supabase
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved"),
    supabase
      .from("user_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "dismissed"),
    supabase
      .from("moderation_audit_log")
      .select(
        "id, report_kind, report_id, action, target_listing_id, target_user_id, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const queueError =
    reportsResponse.error ||
    listingOpen.error ||
    listingReviewing.error ||
    listingResolved.error ||
    listingDismissed.error ||
    userOpen.error ||
    userReviewing.error ||
    userResolved.error ||
    userDismissed.error

  const reports = reportsResponse.data ?? []
  const auditEntries = (auditResponse.data ?? []) as ModerationAuditEntry[]

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">მოდერაცია</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              უსაფრთხოების სიგნალები
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              განცხადებისა და მომხმარებლის რეპორტები ერთ დაცულ რიგშია.
              გადაწყვეტილების სამიზნე ყოველთვის თვითონ რეპორტიდან განისაზღვრება
              და ყველა მოქმედება audit log-ში ინახება.
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
        <div
          role="status"
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {flashLabel(flashRaw)}
        </div>
      ) : null}

      {queueError ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          მოდერაციის რიგის ჩატვირთვა ვერ მოხერხდა. განაახლე გვერდი და სცადე
          ხელახლა.
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="ახალი რეპორტები"
          value={(listingOpen.count ?? 0) + (userOpen.count ?? 0)}
        />
        <StatCard
          label="მიმდინარე დამუშავება"
          value={(listingReviewing.count ?? 0) + (userReviewing.count ?? 0)}
        />
        <StatCard
          label="მოგვარებული"
          value={(listingResolved.count ?? 0) + (userResolved.count ?? 0)}
        />
        <StatCard
          label="უარყოფილი"
          value={(listingDismissed.count ?? 0) + (userDismissed.count ?? 0)}
        />
      </section>

      <nav aria-label="რეპორტის ტიპი" className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/admin/reports?kind=listing&status=${status}`}
          aria-current={kind === "listing" ? "page" : undefined}
          className={kind === "listing" ? "ui-pill-soft" : "ui-pill"}
        >
          განცხადებები
        </Link>
        <Link
          href={`/admin/reports?kind=user&status=${status}`}
          aria-current={kind === "user" ? "page" : undefined}
          className={kind === "user" ? "ui-pill-soft" : "ui-pill"}
        >
          მომხმარებლები
        </Link>
      </nav>

      <nav aria-label="რეპორტის სტატუსი" className="mt-4 flex flex-wrap gap-3">
        {statusTabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/reports?kind=${kind}&status=${tab.key}`}
            aria-current={status === tab.key ? "page" : undefined}
            className={status === tab.key ? "ui-pill-soft" : "ui-pill"}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <section
        aria-label={kind === "listing" ? "განცხადების რეპორტები" : "მომხმარებლის რეპორტები"}
        className="mt-6 space-y-5"
      >
        {!queueError && reports.length > 0 ? (
          kind === "listing" ? (
            (reports as AdminListingReport[]).map((item) => (
              <AdminReviewCard key={item.id} item={item} />
            ))
          ) : (
            (reports as AdminUserReport[]).map((item) => (
              <AdminUserReviewCard key={item.id} item={item} />
            ))
          )
        ) : !queueError ? (
          <div className="ui-card border-dashed px-6 py-12 text-center text-sm text-text-soft">
            ამ ფილტრში რეპორტები არ მოიძებნა.
          </div>
        ) : null}
      </section>

      <section aria-labelledby="moderation-audit-heading" className="mt-10">
        <div className="ui-card p-6">
          <div className="ui-eyebrow">Audit log</div>
          <h2
            id="moderation-audit-heading"
            className="mt-3 text-2xl font-black text-text"
          >
            ბოლო მოდერაციის მოქმედებები
          </h2>

          {auditResponse.error ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              audit log-ის ჩატვირთვა ვერ მოხერხდა.
            </p>
          ) : auditEntries.length > 0 ? (
            <ol className="mt-5 divide-y divide-line">
              {auditEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <span className="font-semibold text-text">
                    {auditActionLabel(entry.action)}
                  </span>
                  <span className="text-text-soft">
                    {entry.report_kind === "listing"
                      ? "განცხადების რეპორტი"
                      : "მომხმარებლის რეპორტი"}{" "}
                    · {new Date(entry.created_at).toLocaleString("ka-GE")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-text-soft">
              მოდერაციის მოქმედებები ჯერ არ შესრულებულა.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
