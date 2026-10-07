import Link from "next/link"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"

type SupportThread = {
  id: string
  buyer_id: string
  seller_id: string
  counterparty_username: string | null
  counterparty_full_name: string | null
  counterparty_city: string | null
  counterparty_avatar_url: string | null
  last_message_body: string | null
  last_message_sender_id: string | null
  last_message_created_at: string | null
  unread_count: number
  sort_at: string
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tbilisi",
  }).format(new Date(value))
}

function compactText(value?: string | null, max = 150) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim()
  if (!normalized) return "მიმოწერა ჯერ არ დაწყებულა."
  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export default async function AdminSupportChatsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[]; state?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const rawQuery = typeof params.q === "string" ? params.q : ""
  const q = rawQuery.trim().toLocaleLowerCase("ka-GE").slice(0, 120)
  const requestedState = typeof params.state === "string" ? params.state : "all"
  const state = requestedState === "unread" || requestedState === "waiting" ? requestedState : "all"

  const { supabase } = await requireAdminUser("/dashboard")

  const { data, error } = await supabase
    .from("chat_threads")
    .select(
      "id, buyer_id, seller_id, counterparty_username, counterparty_full_name, counterparty_city, counterparty_avatar_url, last_message_body, last_message_sender_id, last_message_created_at, unread_count, sort_at",
    )
    .eq("chat_type", "support")
    .eq("is_archived", false)
    .order("sort_at", { ascending: false })
    .limit(250)

  let threads = (data ?? []) as SupportThread[]

  const totalCount = threads.length
  const unreadCount = threads.filter((thread) => (thread.unread_count ?? 0) > 0).length
  const waitingCount = threads.filter(
    (thread) => thread.last_message_sender_id === thread.buyer_id,
  ).length

  if (state === "unread") {
    threads = threads.filter((thread) => (thread.unread_count ?? 0) > 0)
  } else if (state === "waiting") {
    threads = threads.filter(
      (thread) => thread.last_message_sender_id === thread.buyer_id,
    )
  }

  if (q) {
    threads = threads.filter((thread) =>
      [
        thread.counterparty_full_name,
        thread.counterparty_username,
        thread.counterparty_city,
        thread.last_message_body,
        thread.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ka-GE")
        .includes(q),
    )
  }

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Support / Live Chat</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              SamoSell Help Inbox
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              Welcome მესიჯზე მომხმარებლის პასუხები აქ იყრის თავს. ყველა აქტიურ admin-ს შეუძლია ნახოს და უპასუხოს; მომხმარებელი პასუხს ყოველთვის SamoSell Help-ის სახელით მიიღებს.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/support" className="ui-btn-secondary">
              Support Tickets
            </Link>
            <Link href="/admin" className="ui-btn-secondary">
              ადმინისტრირების მთავარი
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="ყველა Live Chat" value={totalCount} />
        <StatCard label="წაუკითხავი" value={unreadCount} />
        <StatCard label="პასუხს ელოდება" value={waitingCount} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            name="q"
            defaultValue={rawQuery}
            className="ui-input"
            placeholder="სახელი, username, ქალაქი, ტექსტი…"
          />
          <select name="state" defaultValue={state} className="ui-input">
            <option value="all">ყველა საუბარი</option>
            <option value="unread">მხოლოდ წაუკითხავი</option>
            <option value="waiting">პასუხს ელოდება</option>
          </select>
          <button className="ui-btn-primary">გაფილტვრა</button>
        </form>
      </section>

      {error ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Live Support Inbox ვერ ჩაიტვირთა: {error.message}
        </div>
      ) : null}

      <section className="mt-6 space-y-3">
        {threads.length ? threads.map((thread) => {
          const customerLabel =
            thread.counterparty_full_name ||
            thread.counterparty_username ||
            "მომხმარებელი"
          const waiting = thread.last_message_sender_id === thread.buyer_id
          const unread = thread.unread_count ?? 0

          return (
            <Link
              key={thread.id}
              href={`/admin/support/chats/${thread.id}`}
              className="ui-card block p-4 transition hover:border-brand/40 hover:bg-white sm:p-5"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-brand-soft text-sm font-black text-brand">
                  {thread.counterparty_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thread.counterparty_avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    customerLabel.slice(0, 1).toLocaleUpperCase("ka-GE")
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-black text-text">{customerLabel}</h2>
                    {thread.counterparty_username ? (
                      <span className="text-xs text-text-soft">@{thread.counterparty_username}</span>
                    ) : null}
                    {unread > 0 ? (
                      <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-black text-white">
                        {unread} ახალი
                      </span>
                    ) : null}
                    {waiting ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                        პასუხს ელოდება
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                        გუნდის პასუხი გაგზავნილია
                      </span>
                    )}
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-soft">
                    {compactText(thread.last_message_body)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-soft">
                    {thread.counterparty_city ? <span>{thread.counterparty_city}</span> : null}
                    <span>{formatDate(thread.last_message_created_at || thread.sort_at)}</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        }) : (
          <div className="ui-card border-dashed px-6 py-10 text-sm leading-7 text-text-soft">
            ამ ფილტრებით Live Support საუბარი ვერ მოიძებნა.
          </div>
        )}
      </section>
    </main>
  )
}
