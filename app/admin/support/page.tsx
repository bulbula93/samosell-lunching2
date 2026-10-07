import Link from "next/link"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"
import { adminSupportTicketAction } from "./actions"

type TicketStatus = "open" | "reviewing" | "resolved" | "closed"
type TicketPriority = "normal" | "high"

type SupportTicket = {
  id: string
  user_id: string | null
  account_email: string
  category: string
  subject: string
  message: string
  status: TicketStatus
  priority: TicketPriority
  assigned_to: string | null
  admin_note: string | null
  reviewed_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

const statusTabs: Array<{ key: "all" | TicketStatus; label: string }> = [
  { key: "all", label: "ყველა" },
  { key: "open", label: "ახალი" },
  { key: "reviewing", label: "დამუშავებაში" },
  { key: "resolved", label: "მოგვარებული" },
  { key: "closed", label: "დახურული" },
]

function categoryLabel(value: string) {
  switch (value) {
    case "account": return "ანგარიში"
    case "listing": return "განცხადება"
    case "chat": return "ჩათი"
    case "technical": return "ტექნიკური პრობლემა"
    case "safety": return "უსაფრთხოება"
    case "other": return "სხვა საკითხი"
    default: return value
  }
}

function statusLabel(value: TicketStatus) {
  switch (value) {
    case "open": return "ახალი"
    case "reviewing": return "დამუშავებაში"
    case "resolved": return "მოგვარებული"
    case "closed": return "დახურული"
  }
}

function statusClass(value: TicketStatus) {
  switch (value) {
    case "open":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "reviewing":
      return "border-sky-200 bg-sky-50 text-sky-800"
    case "resolved":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    case "closed":
      return "border-neutral-200 bg-neutral-100 text-neutral-700"
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tbilisi",
  }).format(new Date(value))
}

function supportHref({
  status,
  priority,
  q,
}: {
  status: string
  priority: string
  q: string
}) {
  const params = new URLSearchParams()
  if (status !== "all") params.set("status", status)
  if (priority === "high") params.set("priority", "high")
  if (q) params.set("q", q)
  const query = params.toString()
  return query ? `/admin/support?${query}` : "/admin/support"
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string | string[]
    priority?: string | string[]
    q?: string | string[]
    ok?: string | string[]
    error?: string | string[]
  }>
}) {
  const params = (await searchParams) ?? {}
  const requestedStatus = typeof params.status === "string" ? params.status : "all"
  const status: "all" | TicketStatus =
    requestedStatus === "open" ||
    requestedStatus === "reviewing" ||
    requestedStatus === "resolved" ||
    requestedStatus === "closed"
      ? requestedStatus
      : "all"
  const priority = params.priority === "high" ? "high" : "all"
  const rawQuery = typeof params.q === "string" ? params.q : ""
  const q = rawQuery.trim().toLocaleLowerCase("ka-GE").slice(0, 120)
  const ok = typeof params.ok === "string" ? params.ok : ""
  const error = typeof params.error === "string" ? params.error : ""

  const { supabase } = await requireAdminUser("/dashboard")

  let ticketsQuery = supabase
    .from("support_tickets")
    .select(
      "id, user_id, account_email, category, subject, message, status, priority, assigned_to, admin_note, reviewed_at, closed_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(250)

  if (status !== "all") ticketsQuery = ticketsQuery.eq("status", status)
  if (priority === "high") ticketsQuery = ticketsQuery.eq("priority", "high")

  const [
    ticketsResponse,
    openCount,
    reviewingCount,
    resolvedCount,
    closedCount,
    highOpenCount,
  ] = await Promise.all([
    ticketsQuery,
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "resolved"),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "closed"),
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("priority", "high")
      .in("status", ["open", "reviewing"]),
  ])

  let tickets = (ticketsResponse.data ?? []) as SupportTicket[]

  if (q) {
    tickets = tickets.filter((ticket) =>
      [
        ticket.account_email,
        ticket.category,
        categoryLabel(ticket.category),
        ticket.subject,
        ticket.message,
        ticket.admin_note,
        ticket.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ka-GE")
        .includes(q),
    )
  }

  tickets.sort((left, right) => {
    if (left.priority !== right.priority) return left.priority === "high" ? -1 : 1
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })

  const profileIds = [
    ...new Set(
      tickets
        .flatMap((ticket) => [ticket.user_id, ticket.assigned_to])
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  const profilesResponse = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, full_name")
        .in("id", profileIds)
    : { data: [], error: null }

  const profiles = new Map(
    (profilesResponse.data ?? []).map((profile) => [profile.id, profile]),
  )

  const queryError =
    ticketsResponse.error ||
    openCount.error ||
    reviewingCount.error ||
    resolvedCount.error ||
    closedCount.error ||
    highOpenCount.error ||
    profilesResponse.error

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Support</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              Support Inbox
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              საიტიდან გამოგზავნილი მხარდაჭერის მოთხოვნები ინახება ერთ queue-ში. უსაფრთხოების საკითხები ავტომატურად მაღალი პრიორიტეტით აღინიშნება, ხოლო ყველა admin სტატუსის ცვლილება Audit Log-ში ჩაიწერება.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/support/chats" className="ui-btn-primary">Live Support Chat</Link>
            <Link href="/admin/audit" className="ui-btn-secondary">Audit Log</Link>
            <Link href="/admin/system" className="ui-btn-secondary">System Status</Link>
            <Link href="/admin" className="ui-btn-secondary">ადმინისტრირების მთავარი</Link>
          </div>
        </div>
      </section>

      {ok ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="ახალი" value={openCount.count ?? 0} />
        <StatCard label="დამუშავებაში" value={reviewingCount.count ?? 0} />
        <StatCard label="მაღალი პრიორიტეტი" value={highOpenCount.count ?? 0} />
        <StatCard label="მოგვარებული" value={resolvedCount.count ?? 0} />
        <StatCard label="დახურული" value={closedCount.count ?? 0} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_180px_auto]">
          <input
            name="q"
            defaultValue={rawQuery}
            className="ui-input"
            placeholder="Ticket ID, email, სათაური, ტექსტი…"
          />
          <select name="status" defaultValue={status} className="ui-input">
            {statusTabs.map((tab) => (
              <option key={tab.key} value={tab.key}>{tab.label}</option>
            ))}
          </select>
          <select name="priority" defaultValue={priority} className="ui-input">
            <option value="all">ყველა პრიორიტეტი</option>
            <option value="high">მაღალი პრიორიტეტი</option>
          </select>
          <button className="ui-btn-primary">გაფილტვრა</button>
        </form>

        <nav aria-label="Support სტატუსები" className="mt-4 flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <Link
              key={tab.key}
              href={supportHref({ status: tab.key, priority, q: rawQuery })}
              aria-current={status === tab.key ? "page" : undefined}
              className={status === tab.key ? "ui-pill-soft" : "ui-pill"}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </section>

      {queryError ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Support queue სრულად ვერ ჩაიტვირთა: {queryError.message}
        </div>
      ) : null}

      <section className="mt-6 space-y-4">
        {tickets.length ? tickets.map((ticket) => {
          const customer = ticket.user_id ? profiles.get(ticket.user_id) : null
          const assigned = ticket.assigned_to ? profiles.get(ticket.assigned_to) : null
          const mailSubject = encodeURIComponent(`SamoSell Support — ${ticket.subject}`)

          return (
            <article key={ticket.id} className="ui-card p-5 sm:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(ticket.status)}`}>
                      {statusLabel(ticket.status)}
                    </span>
                    <span className={ticket.priority === "high"
                      ? "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800"
                      : "rounded-full border border-line bg-surface-alt px-3 py-1 text-xs font-semibold text-text-soft"}>
                      {ticket.priority === "high" ? "მაღალი პრიორიტეტი" : "სტანდარტული"}
                    </span>
                    <span className="ui-pill !px-3 !py-1 text-xs">
                      {categoryLabel(ticket.category)}
                    </span>
                  </div>

                  <h2 className="mt-3 break-words text-xl font-black text-text sm:text-2xl">
                    {ticket.subject}
                  </h2>

                  <div className="mt-2 text-sm text-text-soft">
                    {customer?.full_name || customer?.username || ticket.account_email} · {formatDate(ticket.created_at)}
                  </div>

                  <div className="mt-4 whitespace-pre-wrap break-words rounded-[1.2rem] border border-line bg-surface-alt px-4 py-4 text-sm leading-7 text-text-soft [overflow-wrap:anywhere]">
                    {ticket.message}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <div className="font-semibold text-text">ელფოსტა</div>
                      <div className="mt-1 break-all">{ticket.account_email}</div>
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <div className="font-semibold text-text">Ticket ID</div>
                      <div className="mt-1 break-all">{ticket.id}</div>
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <div className="font-semibold text-text">Assigned</div>
                      <div className="mt-1">{assigned?.full_name || assigned?.username || "—"}</div>
                    </div>
                    <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
                      <div className="font-semibold text-text">ბოლო განახლება</div>
                      <div className="mt-1">{formatDate(ticket.updated_at)}</div>
                    </div>
                  </div>

                  {ticket.admin_note ? (
                    <div className="mt-4 rounded-[1rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
                      <span className="font-bold">Admin note:</span> {ticket.admin_note}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <a
                    href={`mailto:${ticket.account_email}?subject=${mailSubject}`}
                    className="ui-btn-primary block text-center"
                  >
                    პასუხის გაგზავნა email-ით
                  </a>

                  {customer?.username ? (
                    <Link
                      href={`/seller/${encodeURIComponent(customer.username)}`}
                      className="ui-btn-secondary block text-center"
                    >
                      მომხმარებლის პროფილი
                    </Link>
                  ) : null}

                  <form action={adminSupportTicketAction} className="rounded-[1.2rem] border border-line bg-surface-alt p-4">
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-text">Admin შენიშვნა</span>
                      <textarea
                        name="adminNote"
                        defaultValue={ticket.admin_note ?? ""}
                        maxLength={2000}
                        className="min-h-24 w-full rounded-[1rem] border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                        placeholder="შიდა შენიშვნა"
                      />
                    </label>

                    <div className="mt-3 grid gap-2">
                      {ticket.status === "open" ? (
                        <>
                          <button name="decision" value="reviewing" className="ui-btn-primary">
                            დამუშავების დაწყება
                          </button>
                          <button name="decision" value="resolved" className="ui-btn-secondary">
                            მოგვარებულად მონიშვნა
                          </button>
                          <button name="decision" value="closed" className="ui-btn-secondary">
                            დახურვა
                          </button>
                        </>
                      ) : null}

                      {ticket.status === "reviewing" ? (
                        <>
                          <button name="decision" value="resolved" className="ui-btn-primary">
                            მოგვარებულად მონიშვნა
                          </button>
                          <button name="decision" value="closed" className="ui-btn-secondary">
                            დახურვა
                          </button>
                        </>
                      ) : null}

                      {ticket.status === "resolved" ? (
                        <>
                          <button name="decision" value="reopen" className="ui-btn-secondary">
                            ხელახლა გახსნა
                          </button>
                          <button name="decision" value="closed" className="ui-btn-primary">
                            საბოლოოდ დახურვა
                          </button>
                        </>
                      ) : null}

                      {ticket.status === "closed" ? (
                        <button name="decision" value="reopen" className="ui-btn-secondary">
                          ხელახლა გახსნა
                        </button>
                      ) : null}
                    </div>
                  </form>
                </div>
              </div>
            </article>
          )
        }) : (
          <div className="ui-card border-dashed px-6 py-10 text-sm leading-7 text-text-soft">
            ამ ფილტრებით Support მოთხოვნა ვერ მოიძებნა.
          </div>
        )}
      </section>
    </main>
  )
}
