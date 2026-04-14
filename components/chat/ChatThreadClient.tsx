"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatBubbleTimestamp } from "@/lib/chats"
import { humanizeSupabaseError } from "@/lib/listings"
import type { ChatMessage } from "@/types/chat"

export default function ChatThreadClient({
  chatId,
  currentUserId,
  readField,
  initialMessages,
  otherPartyLabel,
}: {
  chatId: string
  currentUserId: string
  readField: "buyer_last_read_at" | "seller_last_read_at"
  initialMessages: ChatMessage[]
  otherPartyLabel: string
}) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const viewportRef = useRef<HTMLDivElement | null>(null)

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = viewportRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    })
  }

  const markRead = useCallback(async () => {
    await supabase
      .from("chats")
      .update({ [readField]: new Date().toISOString() })
      .eq("id", chatId)
  }, [chatId, readField, supabase])

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    scrollToBottom()
    const lastMessage = initialMessages.at(-1)
    if (lastMessage && lastMessage.sender_id !== currentUserId) {
      void markRead()
    }
  }, [currentUserId, initialMessages, markRead])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
          const incoming = payload.new as ChatMessage
          setMessages((current) => {
            if (current.some((item) => item.id === incoming.id)) return current
            return [...current, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at))
          })
          if (incoming.sender_id !== currentUserId) {
            void markRead()
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [chatId, currentUserId, markRead, supabase])

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || sending) return
    setSending(true)
    setError("")

    const { data: insertedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: currentUserId,
        body: trimmed,
      })
      .select("id, chat_id, sender_id, body, created_at")
      .single()

    if (insertError) {
      setError(humanizeSupabaseError(insertError.message))
      setSending(false)
      return
    }

    if (insertedMessage) {
      setMessages((current) => {
        if (current.some((item) => item.id === insertedMessage.id)) return current
        return [...current, insertedMessage as ChatMessage].sort((a, b) => a.created_at.localeCompare(b.created_at))
      })
    }

    setBody("")
    setSending(false)
    void markRead()
  }

  return (
    <div className="rounded-[2rem] border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-6 py-4">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">Live chat</div>
        <div className="mt-2 text-xl font-black text-neutral-900">დიალოგი: {otherPartyLabel}</div>
      </div>

      <div ref={viewportRef} className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length > 0 ? (
          messages.map((message) => {
            const mine = message.sender_id === currentUserId
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 shadow-sm sm:max-w-[75%] ${
                    mine ? "bg-black text-white" : "border border-neutral-200 bg-neutral-50 text-neutral-900"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</div>
                  <div className={`mt-2 text-[11px] ${mine ? "text-neutral-300" : "text-neutral-500"}`}>
                    {formatBubbleTimestamp(message.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-600">
            ჯერ შეტყობინება არ არის. დაიწყე დიალოგი პირველივე მესიჯით.
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="border-t border-neutral-200 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold text-neutral-700">შეტყობინება</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="მაგალითად: გამარჯობა, ეს ნივთი ისევ ხელმისაწვდომია?"
              className="min-h-24 w-full rounded-[1.5rem] border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="h-12 rounded-full bg-black px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {sending ? "იგზავნება..." : "გაგზავნა"}
          </button>
        </div>
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </form>
    </div>
  )
}
