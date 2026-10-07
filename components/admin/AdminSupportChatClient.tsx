"use client"

import Image from "next/image"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"
import {
  loadOlderAdminSupportMessagesAction,
  markAdminSupportChatReadAction,
  sendAdminSupportMessageAction,
} from "@/app/admin/support/chats/actions"
import { CHAT_MESSAGE_MAX_LENGTH, formatBubbleTimestamp } from "@/lib/chats"
import { createClient } from "@/lib/supabase/client"
import type { ChatMessage } from "@/types/chat"

function sortMessages(messages: ChatMessage[]) {
  return messages.toSorted((left, right) => {
    const timestampOrder = left.created_at.localeCompare(right.created_at)
    return timestampOrder === 0 ? left.id.localeCompare(right.id) : timestampOrder
  })
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return sortMessages([...byId.values()])
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Partial<ChatMessage>
  return (
    typeof message.id === "string" &&
    typeof message.chat_id === "string" &&
    typeof message.sender_id === "string" &&
    typeof message.body === "string" &&
    typeof message.created_at === "string"
  )
}

export default function AdminSupportChatClient({
  chatId,
  buyerId,
  initialMessages,
  initialHasMore,
}: {
  chatId: string
  buyerId: string
  initialMessages: ChatMessage[]
  initialHasMore: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      const viewport = viewportRef.current
      if (!viewport) return
      viewport.scrollTo({ top: viewport.scrollHeight, behavior })
    })
  }, [])

  const markRead = useCallback(async () => {
    await markAdminSupportChatReadAction(chatId)
  }, [chatId])

  useEffect(() => {
    scrollToBottom()
    const last = initialMessages.at(-1)
    if (last?.sender_id === buyerId) void markRead()
  }, [buyerId, initialMessages, markRead, scrollToBottom])

  useEffect(() => {
    const channel = supabase
      .channel(`admin-support:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (!isChatMessage(payload.new)) return
          const incoming = payload.new
          setMessages((current) => mergeMessages(current, [incoming]))
          if (incoming.sender_id === buyerId) void markRead()
          scrollToBottom("smooth")
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [buyerId, chatId, markRead, scrollToBottom, supabase])

  async function loadOlder() {
    const earliest = messages[0]
    if (!earliest || loadingOlder || !hasMore) return

    setLoadingOlder(true)
    const viewport = viewportRef.current
    const previousHeight = viewport?.scrollHeight ?? 0

    const result = await loadOlderAdminSupportMessagesAction(chatId, {
      createdAt: earliest.created_at,
      id: earliest.id,
    })

    if (result.ok) {
      setMessages((current) => mergeMessages(current, result.messages))
      setHasMore(result.hasMore)
      requestAnimationFrame(() => {
        if (viewport) viewport.scrollTop += viewport.scrollHeight - previousHeight
      })
    }

    setLoadingOlder(false)
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return

    setSending(true)
    setSendError("")
    const result = await sendAdminSupportMessageAction({
      chatId,
      body: trimmed,
      clientRequestId: crypto.randomUUID(),
    })

    if (!result.ok) {
      setSendError(result.message)
      setSending(false)
      return
    }

    setMessages((current) => mergeMessages(current, [result.message]))
    setBody("")
    setSending(false)
    scrollToBottom()
  }

  return (
    <section className="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-line bg-white">
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          {hasMore ? (
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={() => void loadOlder()}
                disabled={loadingOlder}
                className="rounded-full bg-surface-alt px-4 py-2 text-xs font-bold text-text-soft disabled:opacity-60"
              >
                {loadingOlder ? "იტვირთება…" : "ძველი შეტყობინებების ჩატვირთვა"}
              </button>
            </div>
          ) : (
            <p className="mb-4 text-center text-[11px] font-semibold text-text-soft">
              მიმოწერის დასაწყისი
            </p>
          )}

          {messages.map((message, index) => {
            const fromCustomer = message.sender_id === buyerId
            const previous = messages[index - 1]
            const grouped = Boolean(previous) && previous.sender_id === message.sender_id
            const imageUrl = `/api/chats/media/${encodeURIComponent(message.id)}`
            const showImageCaption =
              message.message_type === "image" && message.body !== "📷 ფოტო"

            return (
              <article
                key={message.id}
                className={`flex ${fromCustomer ? "justify-start" : "justify-end"} ${grouped ? "mt-1" : "mt-3"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 sm:max-w-[72%] ${
                    fromCustomer
                      ? "rounded-bl-md bg-surface-alt text-text"
                      : "rounded-br-md bg-brand text-white"
                  }`}
                >
                  <div className={`mb-1 text-[10px] font-black uppercase tracking-wide ${
                    fromCustomer ? "text-text-soft" : "text-white/70"
                  }`}>
                    {fromCustomer ? "მომხმარებელი" : "SamoSell Help"}
                  </div>

                  {message.message_type === "image" ? (
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl bg-black/5"
                    >
                      <Image
                        src={imageUrl}
                        alt="Support ჩათში გაგზავნილი ფოტო"
                        width={720}
                        height={720}
                        unoptimized
                        className="max-h-[420px] w-auto max-w-full object-contain"
                      />
                    </a>
                  ) : null}

                  {message.message_type !== "image" || showImageCaption ? (
                    <p className={`${message.message_type === "image" ? "mt-2" : ""} whitespace-pre-wrap break-words text-sm leading-5 [overflow-wrap:anywhere]`}>
                      {message.body}
                    </p>
                  ) : null}

                  <time
                    suppressHydrationWarning
                    dateTime={message.created_at}
                    className={`mt-1.5 block text-right text-[10px] ${fromCustomer ? "text-text-soft" : "text-white/70"}`}
                  >
                    {formatBubbleTimestamp(message.created_at)}
                  </time>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <form onSubmit={send} className="border-t border-line bg-white px-3 py-3 sm:px-5">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <label htmlFor="admin-support-message" className="sr-only">
            პასუხი
          </label>
          <textarea
            id="admin-support-message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            rows={2}
            placeholder="მიწერე მომხმარებელს როგორც SamoSell Help…"
            className="min-h-12 flex-1 resize-none rounded-2xl border border-line bg-surface-alt px-4 py-3 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand-soft"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-5 text-sm font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "იგზავნება…" : "გაგზავნა"}
          </button>
        </div>
        {sendError ? (
          <p role="alert" className="mx-auto mt-2 max-w-3xl text-sm font-semibold text-red-700">
            {sendError}
          </p>
        ) : null}
      </form>
    </section>
  )
}
