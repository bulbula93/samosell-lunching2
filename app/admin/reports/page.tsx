import Link from "next/link"
import AdminReviewCard from "@/components/moderation/AdminReviewCard"
import AdminUserReviewCard from "@/components/moderation/AdminUserReviewCard"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"
import {
  isReportStatus,
  reportPriority,
  reportPriorityScore,
  type ModerationPriority,
} from "@/lib/moderation"
import type {
  AdminListingReport,
  AdminUserReport,
  ModerationAuditEntry,
} from "@/types/moderation"

const PAGE_SIZE = 30
const TRIAGE_SCAN_LIMIT = 500

const LISTING_REPORT_SELECT =
  "id, listing_id, reporter_id, seller_id, reason, details, status, moderation_note, reviewed_by, reviewed_at, created_at, updated_at, listing_slug, listing_title, listing_status, price, currency, cover_image_url, reporter_username, reporter_full_name, seller_username, seller_full_name, seller_is_suspended"
const USER_REPORT_SELECT =
  "id, reporter_id, reported_user_id, context_listing_id, reason, details, status, moderation_note, reviewed_by, reviewed_at, created_at, updated_at, reporter_username, reporter_full_name, reported_username, reported_full_name, reported_avatar_url, reported_is_suspended, context_listing_slug, context_listing_title, context_listing_status"

type QueueKind = "all" | "listing" | "user"
type PriorityFilter = "all" | "high"
type QueueEntry =
  | { kind: "listing"; item: AdminListingReport; priority: ModerationPriority }
  | { kind: "user"; item: AdminUserReport; priority: ModerationPriority }

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

function reportsHref({
  kind,
  status,
  priority,
}: {
  kind: QueueKind
  status: string
  priority: PriorityFilter
}) {
  const params = new URLSearchParams({ kind, status })
  if (priority === "high") params.set("priority", "high")
  return `/admin/reports?${params.toString()}`
}

function incrementCount(map: Map<string, number>, key?: string | null) {
  if (!key) return
  map.set(key, (map.get(key) ?? 0) + 1)
}

const statusTabs = [
  { key: "open", label: "ახალი" },
  { key: "reviewing", label: "მიმდინარე" },
  { key: "resolved", label: "დასრულებული" },
  { key: "dismissed", label: "უარყოფილი" },
  { key: "all", label: "ყველა" },
] as const

const kindTabs: Array<{ key: QueueKind; label: string }> = [
  { key: "all", label: "ყველა სიგნალი" },
  { key: "listing", label: "განცხადებები" },
  { key: "user", label: "მომხმარებლები" },
]

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string | string[]
    kind?: string | string[]
    priority?: string | string[]
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
  const requestedKind = typeof params.kind === "string" ? params.kind : "all"
  const kind: QueueKind =
    requestedKind === "listing" || requestedKind === "user" ? requestedKind : "all"
  const priority: PriorityFilter = params.priority === "high" ? "high" : "all"
  const flashRaw = typeof params.flash === "string" ? params.flash : ""
  const { supabase } = await requireAdminUser("/dashboard")
  const referenceTime = new Date().toISOString()

  let listingReportsQuery = supabase
    .from("admin_listing_reports")
    .select(LISTING_REPORT_SELECT)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE * 2)
  let userReportsQuery = supabase
    .from("admin_user_reports")
    .select(USER_REPORT_SELECT)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE * 2)

  if (status !== "all") {
    listingReportsQuery = listingReportsQuery.eq("status", status)
    userReportsQuery = userReportsQuery.eq("status", status)
  }

  const [
    listingReportsResponse,
    userReportsResponse,
    listingOpen,
    listingReviewing,
    listingResolved,
    listingDismissed,
    userOpen,
    userReviewing,
    userResolved,
    userDismissed,
    listingActiveSignals,
    userActiveSignals,
    auditResponse,
  ] = await Promise.all([
    listingReportsQuery,
    userReportsQuery,
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "dismissed"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("user_reports").select("id", { count: "exact", head: true }).eq("status", "dismissed"),
    supabase
      .from("admin_listing_reports")
      .select("seller_id, reason, status")
      .in("status", ["open", "reviewing"])
      .limit(TRIAGE_SCAN_LIMIT),
    supabase
      .from("admin_user_reports")
      .select("reported_user_id, reason, status")
      .in("status", ["open", "reviewing"])
      .limit(TRIAGE_SCAN_LIMIT),
    supabase
      .from("moderation_audit_log")
      .select(
        "id, report_kind, report_id, action, target_listing_id, target_user_id, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const queueError =
    listingReportsResponse.error ||
    userReportsResponse.error ||
    listingOpen.error ||
    listingReviewing.error ||
    listingResolved.error ||
    listingDismissed.error ||
    userOpen.error ||
    userReviewing.error ||
    userResolved.error ||
    userDismissed.error ||
    listingActiveSignals.error ||
    userActiveSignals.error

  const listingReports = (listingReportsResponse.data ?? []) as AdminListingReport[]
  const userReports = (userReportsResponse.data ?? []) as AdminUserReport[]
  const listingTargetCounts = new Map<string, number>()
  const userTargetCounts = new Map<string, number>()

  for (const row of listingActiveSignals.data ?? []) incrementCount(listingTargetCounts, row.seller_id)
  for (const row of userActiveSignals.data ?? []) incrementCount(userTargetCounts, row.reported_user_id)

  const highPriorityActiveCount =
    (listingActiveSignals.data ?? []).filter(
      (row) => reportPriority("listing", row.reason) === "high",
    ).length +
    (userActiveSignals.data ?? []).filter(
      (row) => reportPriority("user", row.reason) === "high",
    ).length

  let queue: QueueEntry[] = [
    ...listingReports.map((item) => ({
      kind: "listing" as const,
      item,
      priority: reportPriority("listing", item.reason),
    })),
    ...userReports.map((item) => ({
      kind: "user" as const,
      item,
      priority: reportPriority("user", item.reason),
    })),
  ]

  if (kind !== "all") queue = queue.filter((entry) => entry.kind === kind)
  if (priority === "high") queue = queue.filter((entry) => entry.priority === "high")

  queue.sort((left, right) => {
    const priorityDelta =
      reportPriorityScore(right.priority) - reportPriorityScore(left.priority)
    if (priorityDelta !== 0) return priorityDelta
    return (
      new Date(right.item.created_at).getTime() -
      new Date(left.item.created_at).getTime()
    )
  })
  queue = queue.slice(0, PAGE_SIZE)

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
              განცხადებისა და მომხმარებლის რეპორტები ახლა ერთ queue-ში იკრიბება. მაღალი რისკის მიზეზები ზემოთ გადადის, ხოლო ერთსა და იმავე ანგარიშზე განმეორებითი აქტიური სიგნალები ცალკე მონიშვნით ჩანს. ყველა მოდერაციის მოქმედება audit log-ში ინახება.
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
          მოდერაციის რიგის ჩატვირთვა ვერ მოხერხდა. განაახლე გვერდი და სცადე ხელახლა.
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="ახალი რეპორტები"
          value={(listingOpen.count ?? 0) + (userOpen.count ?? 0)}
        />
        <StatCard
          label="მიმდინარე დამუშავება"
          value={(listingReviewing.count ?? 0) + (userReviewing.count ?? 0)}
        />
        <StatCard label="მაღალი რისკის აქტიური" value={highPriorityActiveCount} />
        <StatCard
          label="მოგვარებული"
          value={(listingResolved.count ?? 0) + (userResolved.count ?? 0)}
        />
        <StatCard
          label="უარყოფილი"
          value={(listingDismissed.count ?? 0) + (userDismissed.count ?? 0)}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <div className="text-sm font-black text-text">Queue ფილტრები</div>

        <nav aria-label="რეპორტის ტიპი" className="mt-3 flex flex-wrap gap-3">
          {kindTabs.map((tab) => (
            <Link
              key={tab.key}
              href={reportsHref({ kind: tab.key, status, priority })}
              aria-current={kind === tab.key ? "page" : undefined}
              className={kind === tab.key ? "ui-pill-soft" : "ui-pill"}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="რეპორტის სტატუსი" className="mt-3 flex flex-wrap gap-3">
          {statusTabs.map((tab) => (
            <Link
              key={tab.key}
              href={reportsHref({ kind, status: tab.key, priority })}
              aria-current={status === tab.key ? "page" : undefined}
              className={status === tab.key ? "ui-pill-soft" : "ui-pill"}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <nav aria-label="რისკის პრიორიტეტი" className="mt-3 flex flex-wrap gap-3">
          <Link
            href={reportsHref({ kind, status, priority: "all" })}
            aria-current={priority === "all" ? "page" : undefined}
            className={priority === "all" ? "ui-pill-soft" : "ui-pill"}
          >
            ყველა პრიორიტეტი
          </Link>
          <Link
            href={reportsHref({ kind, status, priority: "high" })}
            aria-current={priority === "high" ? "page" : undefined}
            className={priority === "high" ? "ui-pill-soft" : "ui-pill"}
          >
            მხოლოდ მაღალი რისკი
          </Link>
        </nav>
      </section>

      <section aria-label="მოდერაციის ერთიანი რიგი" className="mt-6 space-y-5">
        {!queueError && queue.length > 0 ? (
          queue.map((entry) =>
            entry.kind === "listing" ? (
              <AdminReviewCard
                key={`listing-${entry.item.id}`}
                item={entry.item}
                relatedOpenReports={listingTargetCounts.get(entry.item.seller_id) ?? 1}
                referenceTime={referenceTime}
              />
            ) : (
              <AdminUserReviewCard
                key={`user-${entry.item.id}`}
                item={entry.item}
                relatedOpenReports={userTargetCounts.get(entry.item.reported_user_id) ?? 1}
                referenceTime={referenceTime}
              />
            ),
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
