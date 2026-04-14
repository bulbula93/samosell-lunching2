import { requireAuthenticatedUser } from "@/lib/auth"
import Link from "next/link"
import { updateChatVisibilityAction } from "@/app/dashboard/chats/actions"
import SmartImage from "@/components/shared/SmartImage"
import { chatCounterpartyName, formatChatTimestamp, truncateChatText } from "@/lib/chats"
import { formatPrice } from "@/lib/listings"
import type { ChatThread } from "@/types/chat"

type SearchParams = {
  show?: string | string[]
  flash?: string | string[]
}

const TABS = [
  { key: "inbox", label: "ინბოქსი" },
  { key: "archived", label: "არქივი" },
  { key: "all", label: "ყველა" },
]

export default async function DashboardChatsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {}
  const show = typeof params.show === "string" ? params.show : "inbox"
  const flash = typeof params.flash === "string" ? params.flash : ""

  const { supabase, user } = await requireAuthenticatedUser("/dashboard/chats")

  let query = supabase
    .from("chat_threads")
    .select(
      "id, listing_id, buyer_id, seller_id, created_at, last_message_at, buyer_last_read_at, seller_last_read_at, listing_slug, listing_title, price, currency, listing_status, cover_image_url, counterparty_id, counterparty_username, counterparty_full_name, counterparty_city, last_message_body, last_message_sender_id, last_message_created_at, unread_count, sort_at, is_archived"
    )
    .order("sort_at", { ascending: false })

  if (show === "inbox") query = query.eq("is_archived", false)
  if (show === "archived") query = query.eq("is_archived", true)

  const { data: threads, error } = await query
  const typedThreads = (threads ?? []) as ChatThread[]
  const unreadMessages = typedThreads.reduce((sum, item) => sum + (item.unread_count ?? 0), 0)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">ინბოქსი</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">ჩათები</h1>
          <p className="mt-3 max-w-2xl text-neutral-600">
            აქ ნახავ მყიდველებთან და გამყიდველებთან ყველა დიალოგს. მიმოწერები დაყოფილია შემოსულებსა და არქივს შორის, ხოლო ახალი შეტყობინებები ცალკე აღინიშნება.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-neutral-200 bg-white px-5 py-4 text-left shadow-sm sm:text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">სტატისტიკა</div>
          <div className="mt-2 text-3xl font-black text-neutral-900">{typedThreads.length}</div>
          <div className="text-sm text-neutral-500">ჩათი ამ ხედში</div>
          <div className="mt-1 text-sm text-neutral-700">ახალი მესიჯები: {unreadMessages}</div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {TABS.map((tab) => {
          const active = show === tab.key || (!show && tab.key === "inbox")
          return (
            <Link
              key={tab.key}
              href={tab.key === "inbox" ? "/dashboard/chats" : `/dashboard/chats?show=${tab.key}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${active ? "bg-black text-white" : "border border-neutral-300 bg-white text-neutral-700"}`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {flash ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{flash}</div>
      ) : null}

      {error ? (
        <div className="rounded-[2rem] border border-red-200 bg-red-50 px-6 py-10 text-red-700 shadow-sm">
          ჩათების ჩატვირთვა ვერ მოხერხდა. გადაამოწმე SQL migration-ები და chat_threads view.
        </div>
      ) : typedThreads.length > 0 ? (
        <div className="space-y-4">
          {typedThreads.map((thread) => {
            const hasNewMessage = thread.unread_count > 0 && thread.last_message_sender_id !== user?.id
            return (
              <div
                key={thread.id}
                className="grid gap-4 rounded-[2rem] border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md md:grid-cols-[110px_1fr_auto] md:items-center"
              >
                <Link href={`/dashboard/chats/${thread.id}`} className="aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-neutral-200">
                  <SmartImage src={thread.cover_image_url} alt={thread.listing_title} wrapperClassName="h-full w-full" fallbackLabel="სურათი არ არის" />
                </Link>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/chats/${thread.id}`} className="text-lg font-black text-neutral-900">
                      {thread.listing_title}
                    </Link>
                    {thread.unread_count > 0 ? (
                      <span className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">
                        {thread.unread_count} ახალი
                      </span>
                    ) : null}
                    {hasNewMessage ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-label="ახალი მესიჯი" /> : null}
                    {thread.is_archived ? (
                      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">არქივი</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">
                    {formatPrice(thread.price, thread.currency)} · {chatCounterpartyName(thread)}
                    {thread.counterparty_city ? ` · ${thread.counterparty_city}` : ""}
                  </div>
                  <div className="mt-3 text-sm leading-6 text-neutral-700">{truncateChatText(thread.last_message_body)}</div>
                </div>

                <div className="flex flex-col items-start gap-2 md:items-end">
                  <div className="text-sm font-semibold text-neutral-700">
                    {formatChatTimestamp(thread.last_message_created_at || thread.created_at)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {thread.buyer_id === user?.id ? "მიმოწერა გამყიდველთან" : "მიმოწერა მყიდველთან"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/chats/${thread.id}`} className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">
                      ჩათის გახსნა
                    </Link>
                    <form action={updateChatVisibilityAction}>
                      <input type="hidden" name="chatId" value={thread.id} />
                      <input type="hidden" name="intent" value={thread.is_archived ? "restore" : "archive"} />
                      <input type="hidden" name="nextPath" value={thread.is_archived ? "/dashboard/chats?show=archived" : "/dashboard/chats"} />
                      <button className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">
                        {thread.is_archived ? "აღდგენა" : "დამალვა"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-white px-6 py-12 text-center shadow-sm">
          <div className="text-2xl font-black text-neutral-900">
            {show === "archived" ? "არქივში ჩათი არ არის" : "ჯერ ჩათი არ გაქვს"}
          </div>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-600">
            {show === "archived"
              ? "როცა დიალოგს დამალავ, ის აქ გამოჩნდება და საჭიროების შემთხვევაში კვლავ აღადგენ."
              : "განცხადების გვერდიდან დააჭირე „მიწერე გამყიდველს“ ან დაელოდე მყიდველის პირველ შეტყობინებას."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/catalog" className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">
              კატალოგში გადასვლა
            </Link>
            {show === "archived" ? (
              <Link href="/dashboard/chats" className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700">
                ინბოქსი
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </main>
  )
}
