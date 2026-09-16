"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import Avatar from "@/components/shared/Avatar"
import { chatCounterpartyName, formatChatTimestamp, truncateChatText } from "@/lib/chats"
import { createClient } from "@/lib/supabase/client"
import type { ChatThread } from "@/types/chat"

type InboxFilter = "inbox" | "unread" | "archived"

const FILTERS: Array<{ key: InboxFilter; label: string }> = [
  { key: "inbox", label: "შემოსული" },
  { key: "unread", label: "წაუკითხავი" },
  { key: "archived", label: "არქივი" },
]

type RealtimeMessage = {
  chat_id: string
  sender_id: string
  body: string
  created_at: string
}

type ThreadUpdate = Partial<
  Pick<
    ChatThread,
    | "last_message_body"
    | "last_message_sender_id"
    | "last_message_created_at"
    | "last_message_at"
    | "sort_at"
    | "unread_count"
  >
>

function isRealtimeMessage(value: unknown): value is RealtimeMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Partial<RealtimeMessage>
  return (
    typeof message.chat_id === "string" &&
    typeof message.sender_id === "string" &&
    typeof message.body === "string" &&
    typeof message.created_at === "string"
  )
}

function sortThreads(threads: ChatThread[]) {
  return [...threads].sort((left, right) => {
    const leftSort = left.sort_at || left.last_message_created_at || left.created_at
    const rightSort = right.sort_at || right.last_message_created_at || right.created_at
    const timestampOrder = rightSort.localeCompare(leftSort)
    return timestampOrder === 0 ? right.id.localeCompare(left.id) : timestampOrder
  })
}

function activeChatIdFromPath(pathname: string) {
  const match = pathname.match(/^\/dashboard\/chats\/([^/?#]+)/)
  return match?.[1] ?? null
}

export default function ChatWorkspace({
  currentUserId,
  initialThreads,
  children,
}: {
  currentUserId: string
  initialThreads: ChatThread[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const activeChatId = activeChatIdFromPath(pathname)
  const threadOpen = Boolean(activeChatId)
  const [threadUpdates, setThreadUpdates] = useState<Record<string, ThreadUpdate>>({})
  const [filter, setFilter] = useState<InboxFilter>("inbox")
  const [query, setQuery] = useState("")

  const threads = useMemo(
    () =>
      sortThreads(
        initialThreads.map((thread) => {
          const update = threadUpdates[thread.id]
          const merged = update ? { ...thread, ...update } : thread
          return merged.id === activeChatId && merged.unread_count > 0
            ? { ...merged, unread_count: 0 }
            : merged
        }),
      ),
    [activeChatId, initialThreads, threadUpdates],
  )

  useEffect(() => {
    const channel = supabase
      .channel(`chat-inbox:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (!isRealtimeMessage(payload.new)) return
          const incoming = payload.new
          const baseThread = initialThreads.find(
            (thread) => thread.id === incoming.chat_id,
          )

          if (!baseThread) {
            router.refresh()
            return
          }

          setThreadUpdates((current) => {
            const existingUpdate = current[incoming.chat_id] ?? {}
            const existing = { ...baseThread, ...existingUpdate }
            const nextUnread =
              incoming.sender_id !== currentUserId && activeChatId !== incoming.chat_id
                ? existing.unread_count + 1
                : activeChatId === incoming.chat_id
                  ? 0
                  : existing.unread_count

            return {
              ...current,
              [incoming.chat_id]: {
                ...existingUpdate,
                last_message_body: incoming.body,
                last_message_sender_id: incoming.sender_id,
                last_message_created_at: incoming.created_at,
                last_message_at: incoming.created_at,
                sort_at: incoming.created_at,
                unread_count: nextUnread,
              },
            }
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeChatId, currentUserId, initialThreads, router, supabase])

  function markThreadLocallyRead(chatId: string) {
    setThreadUpdates((current) => {
      const existing = current[chatId] ?? {}
      return {
        ...current,
        [chatId]: {
          ...existing,
          unread_count: 0,
        },
      }
    })
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("ka-GE")
  const visibleThreads = threads.filter((thread) => {
    if (filter === "inbox" && thread.is_archived) return false
    if (filter === "archived" && !thread.is_archived) return false
    if (filter === "unread" && (thread.is_archived || thread.unread_count <= 0)) return false

    if (!normalizedQuery) return true
    const haystack = [
      chatCounterpartyName(thread),
      thread.listing_title,
      thread.last_message_body,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ka-GE")

    return haystack.includes(normalizedQuery)
  })

  const totalUnread = threads.reduce(
    (total, thread) => total + (thread.is_archived ? 0 : Math.max(0, thread.unread_count)),
    0,
  )

  return (
    <main className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5">
      <div className="flex min-h-[calc(100dvh-8rem)] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_60px_rgba(7,63,59,0.08)] lg:h-[calc(100dvh-8rem)] lg:min-h-[620px]">
        <aside
          aria-label="მიმოწერების სია"
          className={`${threadOpen ? "hidden lg:flex" : "flex"} min-w-0 w-full flex-col border-line bg-white lg:w-[350px] lg:shrink-0 lg:border-r`}
        >
          <div className="border-b border-line px-4 pb-4 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-soft">
                  პირადი კომუნიკაცია
                </p>
                <h1 className="mt-1 text-2xl font-black text-text">შეტყობინებები</h1>
              </div>
              {totalUnread > 0 ? (
                <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-brand px-2 py-1 text-xs font-black text-white">
                  {totalUnread}
                </span>
              ) : null}
            </div>

            <label className="mt-4 block">
              <span className="sr-only">მიმოწერების ძებნა</span>
              <div className="flex min-h-11 items-center gap-2 rounded-xl bg-surface-alt px-3 ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-brand">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-current text-text-soft" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ძებნა"
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text outline-none placeholder:text-text-soft"
                />
              </div>
            </label>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="მიმოწერების ფილტრი">
              {FILTERS.map((item) => {
                const active = filter === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(item.key)}
                    className={
                      active
                        ? "whitespace-nowrap rounded-full bg-brand px-3 py-2 text-xs font-black text-white"
                        : "whitespace-nowrap rounded-full bg-surface-alt px-3 py-2 text-xs font-bold text-text-soft transition hover:text-text"
                    }
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {visibleThreads.length > 0 ? (
              <div className="space-y-1">
                {visibleThreads.map((thread) => {
                  const active = activeChatId === thread.id
                  const counterparty = chatCounterpartyName(thread)
                  const hasUnread =
                    thread.unread_count > 0 &&
                    thread.last_message_sender_id !== currentUserId
                  const previewPrefix =
                    thread.last_message_sender_id === currentUserId ? "შენ: " : ""

                  return (
                    <Link
                      key={thread.id}
                      href={`/dashboard/chats/${thread.id}`}
                      onClick={() => markThreadLocallyRead(thread.id)}
                      aria-current={active ? "page" : undefined}
                      className={`grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 transition ${
                        active
                          ? "bg-brand-soft ring-1 ring-inset ring-brand/15"
                          : "hover:bg-surface-alt"
                      }`}
                    >
                      <div className="relative">
                        <Avatar
                          src={thread.counterparty_avatar_url}
                          alt={counterparty}
                          fallbackText={counterparty}
                          sizeClassName="h-12 w-12"
                          textClassName="text-sm"
                        />
                        {hasUnread ? (
                          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`truncate text-sm ${hasUnread ? "font-black text-text" : "font-bold text-text"}`}>
                            {counterparty}
                          </span>
                          {thread.chat_type === "listing" && thread.listing_title ? (
                            <span className="truncate text-[11px] font-semibold text-text-soft">
                              · {thread.listing_title}
                            </span>
                          ) : null}
                        </div>
                        <p className={`mt-1 truncate text-xs ${hasUnread ? "font-bold text-text" : "text-text-soft"}`}>
                          {previewPrefix}
                          {truncateChatText(thread.last_message_body, 64)}
                        </p>
                      </div>

                      <div className="flex min-w-[48px] flex-col items-end gap-1">
                        <time
                          suppressHydrationWarning
                          dateTime={thread.last_message_created_at || thread.created_at}
                          className={`text-[10px] ${hasUnread ? "font-black text-brand" : "font-semibold text-text-soft"}`}
                        >
                          {formatChatTimestamp(thread.last_message_created_at || thread.created_at)}
                        </time>
                        {hasUnread ? (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-black text-white">
                            {thread.unread_count > 99 ? "99+" : thread.unread_count}
                          </span>
                        ) : thread.is_archived ? (
                          <span className="text-[10px] font-bold text-text-soft">არქივი</span>
                        ) : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-bold text-text">მიმოწერა ვერ მოიძებნა</p>
                <p className="mt-2 text-xs leading-5 text-text-soft">
                  შეცვალე ძებნა ან ფილტრი.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-line p-3">
            <Link href="/catalog" className="ui-btn-secondary w-full">
              ნივთების ნახვა
            </Link>
          </div>
        </aside>

        <section
          aria-label="არჩეული მიმოწერა"
          className={`${threadOpen ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col bg-surface-alt/30`}
        >
          {children}
        </section>
      </div>
    </main>
  )
}
