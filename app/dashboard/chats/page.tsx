import Link from "next/link"
import { updateChatVisibilityAction } from "@/app/dashboard/chats/actions"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"
import { requireAuthenticatedUser } from "@/lib/auth"
import {
  CHAT_PAGE_SIZE,
  chatCounterpartyName,
  formatChatTimestamp,
  parseChatInboxFilter,
  parseChatPage,
  truncateChatText,
  type ChatInboxFilter,
} from "@/lib/chats"
import { formatPrice, listingStatusLabel } from "@/lib/listings"
import type { ChatThread } from "@/types/chat"

type SearchParams = {
  show?: string | string[]
  page?: string | string[]
  flash?: string | string[]
}

const TABS: { key: ChatInboxFilter; label: string }[] = [
  { key: "inbox", label: "შემოსული" },
  { key: "archived", label: "არქივი" },
  { key: "all", label: "ყველა" },
]

function inboxHref(show: ChatInboxFilter, page = 1) {
  const params = new URLSearchParams()
  if (show !== "inbox") params.set("show", show)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/dashboard/chats?${query}` : "/dashboard/chats"
}

export default async function DashboardChatsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const params = (await searchParams) ?? {}
  const show = parseChatInboxFilter(
    typeof params.show === "string" ? params.show : undefined,
  )
  const page = parseChatPage(
    typeof params.page === "string" ? params.page : undefined,
  )
  const flash = typeof params.flash === "string" ? params.flash : ""
  const { supabase, user } = await requireAuthenticatedUser(
    inboxHref(show, page),
  )
  const from = (page - 1) * CHAT_PAGE_SIZE
  const to = from + CHAT_PAGE_SIZE - 1
  const participantFilter = `buyer_id.eq.${user.id},seller_id.eq.${user.id}`

  let query = supabase
    .from("chat_threads")
    .select(
      "id, listing_id, buyer_id, seller_id, created_at, last_message_at, buyer_last_read_at, seller_last_read_at, listing_slug, listing_title, price, currency, listing_status, cover_image_url, counterparty_id, counterparty_username, counterparty_full_name, counterparty_city, last_message_body, last_message_sender_id, last_message_created_at, unread_count, sort_at, is_archived, counterparty_avatar_url",
      { count: "exact" },
    )
    .or(participantFilter)
    .order("sort_at", { ascending: false })
    .order("id", { ascending: false })

  if (show === "inbox") query = query.eq("is_archived", false)
  if (show === "archived") query = query.eq("is_archived", true)

  const { data: threads, error, count } = await query.range(from, to)
  const typedThreads = (threads ?? []) as ChatThread[]
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / CHAT_PAGE_SIZE))
  const hasPrevious = page > 1
  const hasNext = page < totalPages

  return (
    <main className="ui-container py-8 sm:py-10">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="ui-eyebrow">პირადი კომუნიკაცია</div>
          <h1 className="mt-3 text-3xl font-black text-text sm:text-4xl">
            შეტყობინებები
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-soft sm:text-base">
            ყველა მიმოწერა კონკრეტულ განცხადებაზეა მიბმული და მხოლოდ მონაწილეებისთვის ჩანს.
          </p>
        </div>
        <Link href="/catalog" className="ui-btn-primary self-start sm:self-auto">
          ნივთების ნახვა
        </Link>
      </div>

      <nav aria-label="მიმოწერების ფილტრი" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = show === tab.key
          return (
            <Link
              key={tab.key}
              href={inboxHref(tab.key)}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "inline-flex min-h-11 items-center rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white"
                  : "ui-btn-secondary"
              }
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {flash ? (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {flash}
        </p>
      ) : null}

      {error ? (
        <section
          aria-labelledby="inbox-error-title"
          className="ui-card border-red-200 bg-red-50 px-6 py-10 text-red-800"
        >
          <h2 id="inbox-error-title" className="text-xl font-black">
            შეტყობინებები ვერ ჩაიტვირთა
          </h2>
          <p className="mt-2 text-sm leading-6">
            სცადე გვერდის განახლება. პრობლემა თუ გაგრძელდა, მოგვიანებით დაბრუნდი.
          </p>
        </section>
      ) : typedThreads.length > 0 ? (
        <>
          <div className="space-y-4">
            {typedThreads.map((thread) => {
              const hasUnread =
                thread.unread_count > 0 &&
                thread.last_message_sender_id !== user.id
              const counterparty = chatCounterpartyName(thread)

              return (
                <article
                  key={thread.id}
                  className="ui-card grid gap-4 p-4 transition hover:border-brand/30 hover:shadow-[0_16px_38px_rgba(7,63,59,0.09)] md:grid-cols-[96px_1fr_auto] md:items-center"
                >
                  <Link
                    href={`/dashboard/chats/${thread.id}`}
                    aria-label={`${thread.listing_title} — მიმოწერის გახსნა`}
                    className="aspect-[4/5] overflow-hidden rounded-xl bg-surface-alt"
                  >
                    <SmartImage
                      src={thread.cover_image_url}
                      alt={thread.listing_title}
                      wrapperClassName="h-full w-full"
                      fallbackLabel="სურათი არ არის"
                    />
                  </Link>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/chats/${thread.id}`}
                        className="break-words text-lg font-black text-text hover:text-brand"
                      >
                        {thread.listing_title}
                      </Link>
                      {hasUnread ? (
                        <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                          {thread.unread_count} წაუკითხავი
                        </span>
                      ) : null}
                      {thread.is_archived ? (
                        <span className="rounded-full bg-surface-alt px-3 py-1 text-xs font-bold text-text-soft">
                          არქივი
                        </span>
                      ) : null}
                      <span className="rounded-full border border-line px-3 py-1 text-xs font-bold text-text-soft">
                        {listingStatusLabel(thread.listing_status)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-sm text-text-soft">
                      <Avatar
                        src={thread.counterparty_avatar_url}
                        alt={counterparty}
                        fallbackText={counterparty}
                        sizeClassName="h-8 w-8"
                        textClassName="text-[10px]"
                      />
                      <span className="truncate font-semibold text-text">
                        {counterparty}
                      </span>
                      {thread.counterparty_city ? (
                        <span className="truncate">· {thread.counterparty_city}</span>
                      ) : null}
                    </div>

                    <p className="mt-3 break-words [overflow-wrap:anywhere] text-sm leading-6 text-text-soft">
                      {truncateChatText(thread.last_message_body)}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <time
                      dateTime={thread.last_message_created_at || thread.created_at}
                      className="text-sm font-semibold text-text-soft"
                    >
                      {formatChatTimestamp(
                        thread.last_message_created_at || thread.created_at,
                      )}
                    </time>
                    <div className="text-sm font-black text-text">
                      {formatPrice(thread.price, thread.currency)}
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Link
                        href={`/dashboard/chats/${thread.id}`}
                        className="ui-btn-primary"
                      >
                        გახსნა
                      </Link>
                      <form action={updateChatVisibilityAction}>
                        <input type="hidden" name="chatId" value={thread.id} />
                        <input
                          type="hidden"
                          name="intent"
                          value={thread.is_archived ? "restore" : "archive"}
                        />
                        <input type="hidden" name="returnTo" value="inbox" />
                        <button className="ui-btn-secondary">
                          {thread.is_archived ? "აღდგენა" : "დამალვა"}
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {hasPrevious || hasNext ? (
            <nav
              aria-label="მიმოწერების გვერდები"
              className="mt-8 flex items-center justify-between gap-4"
            >
              {hasPrevious ? (
                <Link href={inboxHref(show, page - 1)} className="ui-btn-secondary">
                  წინა გვერდი
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm font-semibold text-text-soft">
                გვერდი {page} / {totalPages}
              </span>
              {hasNext ? (
                <Link href={inboxHref(show, page + 1)} className="ui-btn-secondary">
                  შემდეგი გვერდი
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <section
          aria-labelledby="empty-inbox-title"
          className="ui-card border-dashed px-6 py-12 text-center"
        >
          <h2 id="empty-inbox-title" className="text-2xl font-black text-text">
            {show === "archived"
              ? "არქივში მიმოწერა არ არის"
              : show === "all"
                ? "ჯერ მიმოწერა არ გაქვს"
                : "შემოსული შეტყობინებები არ არის"}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-soft">
            {show === "archived"
              ? "დამალული დიალოგები აქ გამოჩნდება და ნებისმიერ დროს შეძლებ აღდგენას."
              : "აქტიური განცხადების გვერდიდან გაუგზავნე გამყიდველს პირველი ტექსტური შეტყობინება."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/catalog" className="ui-btn-primary">
              კატალოგში გადასვლა
            </Link>
            {show !== "inbox" ? (
              <Link href="/dashboard/chats" className="ui-btn-secondary">
                შემოსულების ნახვა
              </Link>
            ) : null}
          </div>
        </section>
      )}
    </main>
  )
}
