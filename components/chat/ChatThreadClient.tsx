"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  loadOlderMessagesAction,
  markChatReadAction,
  sendChatMessageAction,
} from "@/app/dashboard/chats/actions"
import {
  CHAT_MESSAGE_MAX_LENGTH,
  formatBubbleTimestamp,
} from "@/lib/chats"
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

export default function ChatThreadClient({
  chatId,
  currentUserId,
  initialMessages,
  otherPartyLabel,
  canSend,
  initialHasMore,
}: {
  chatId: string
  currentUserId: string
  initialMessages: ChatMessage[]
  otherPartyLabel: string
  canSend: boolean
  initialHasMore: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [olderError, setOlderError] = useState("")
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef("")

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const viewport = viewportRef.current
      if (viewport) viewport.scrollTop = viewport.scrollHeight
    })
  }, [])

  const markRead = useCallback(async () => {
    await markChatReadAction(chatId)
  }, [chatId])

  useEffect(() => {
    scrollToBottom()
    const lastMessage = initialMessages.at(-1)
    if (lastMessage && lastMessage.sender_id !== currentUserId) {
      void markRead()
    }
  }, [currentUserId, initialMessages, markRead, scrollToBottom])

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${chatId}`)
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
          scrollToBottom()
          if (incoming.sender_id !== currentUserId) {
            void markRead()
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [chatId, currentUserId, markRead, scrollToBottom, supabase])

  async function handleLoadOlder() {
    const earliest = messages[0]
    if (!earliest || loadingOlder || !hasMore) return

    setLoadingOlder(true)
    setOlderError("")
    const viewport = viewportRef.current
    const previousHeight = viewport?.scrollHeight ?? 0
    const result = await loadOlderMessagesAction(chatId, {
      createdAt: earliest.created_at,
      id: earliest.id,
    })

    if (!result.ok) {
      setOlderError(result.message)
      setLoadingOlder(false)
      return
    }

    setMessages((current) => mergeMessages(current, result.messages))
    setHasMore(result.hasMore)
    setLoadingOlder(false)
    requestAnimationFrame(() => {
      if (viewport) {
        viewport.scrollTop += viewport.scrollHeight - previousHeight
      }
    })
  }

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending || !canSend) return

    const clientRequestId = requestIdRef.current || crypto.randomUUID()
    requestIdRef.current = clientRequestId
    setSending(true)
    setSendError("")

    const result = await sendChatMessageAction({
      chatId,
      body: trimmed,
      clientRequestId,
    })

    if (!result.ok) {
      setSendError(result.message)
      setSending(false)
      return
    }

    setMessages((current) => mergeMessages(current, [result.message]))
    setBody("")
    requestIdRef.current = crypto.randomUUID()
    setSending(false)
    scrollToBottom()
    void markRead()
  }

  return (
    <section
      aria-labelledby="chat-thread-title"
      className="ui-card flex min-h-[34rem] flex-col overflow-hidden"
    >
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <div className="ui-eyebrow">უსაფრთხო მიმოწერა</div>
        <h2 id="chat-thread-title" className="mt-2 text-xl font-black text-text">
          დიალოგი: {otherPartyLabel}
        </h2>
      </header>

      <div
        ref={viewportRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={`${otherPartyLabel}-თან შეტყობინებები`}
        className="max-h-[62vh] min-h-80 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {hasMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="ui-btn-secondary"
            >
              {loadingOlder ? "იტვირთება…" : "ძველი შეტყობინებების ჩატვირთვა"}
            </button>
          </div>
        ) : messages.length > 0 ? (
          <p className="text-center text-xs text-text-soft">
            მიმოწერის დასაწყისი
          </p>
        ) : null}

        {olderError ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {olderError}
          </p>
        ) : null}

        {messages.length > 0 ? (
          messages.map((message) => {
            const mine = message.sender_id === currentUserId
            return (
              <article
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                aria-label={mine ? "შენი შეტყობინება" : `${otherPartyLabel}-ის შეტყობინება`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${
                    mine
                      ? "bg-brand text-white"
                      : "border border-line bg-surface-alt text-text"
                  }`}
                >
                  <span className="sr-only">
                    {mine ? "შენ დაწერე:" : `${otherPartyLabel} წერს:`}
                  </span>
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6">
                    {message.body}
                  </p>
                  <time
                    dateTime={message.created_at}
                    className={`mt-2 block text-[11px] ${
                      mine ? "text-white/75" : "text-text-soft"
                    }`}
                  >
                    {formatBubbleTimestamp(message.created_at)}
                  </time>
                </div>
              </article>
            )
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-surface-alt px-5 py-8 text-center text-sm leading-6 text-text-soft">
            შეტყობინებები ჯერ არ არის.
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="border-t border-line bg-white px-4 py-4 sm:px-6"
      >
        {canSend ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="chat-message-body" className="mb-2 block text-sm font-bold text-text">
                შეტყობინება
              </label>
              <textarea
                id="chat-message-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={CHAT_MESSAGE_MAX_LENGTH}
                required
                aria-describedby="chat-message-help chat-message-feedback"
                placeholder="დაწერე ტექსტური შეტყობინება…"
                className="min-h-24 w-full resize-y rounded-xl border border-line px-4 py-3 text-sm leading-6 text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft"
              />
              <div id="chat-message-help" className="mt-1 text-xs text-text-soft">
                {body.length}/{CHAT_MESSAGE_MAX_LENGTH} · მხოლოდ ტექსტი
              </div>
            </div>
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="ui-btn-primary h-12 shrink-0"
            >
              {sending ? "იგზავნება…" : "გაგზავნა"}
            </button>
          </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            ამ განცხადების მიმდინარე სტატუსზე მიმოწერის ისტორია ხელმისაწვდომია, მაგრამ ახალი შეტყობინების გაგზავნა შეზღუდულია.
          </p>
        )}

        <div
          id="chat-message-feedback"
          role={sendError ? "alert" : "status"}
          aria-live="polite"
          className={sendError ? "mt-3 text-sm font-semibold text-red-700" : "sr-only"}
        >
          {sendError || (sending ? "შეტყობინება იგზავნება." : "")}
        </div>
      </form>
    </section>
  )
}
