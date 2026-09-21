"use client"

import Image from "next/image"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import {
  abortChatImageUploadAction,
  loadOlderMessagesAction,
  loadRealtimeMessageAction,
  markChatReadAction,
  prepareChatImageUploadAction,
  sendChatImageMessageAction,
  sendChatMessageAction,
} from "@/app/dashboard/chats/actions"
import {
  CHAT_IMAGE_BUCKET,
  CHAT_IMAGE_MAX_BYTES,
  isChatImageMimeType,
} from "@/lib/chat-images"
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

function nearBottom(viewport: HTMLDivElement | null, threshold = 120) {
  if (!viewport) return true
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold
}

function formatImageSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [olderError, setOlderError] = useState("")
  const [newMessageCount, setNewMessageCount] = useState(0)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const requestIdRef = useRef("")
  const previewUrlRef = useRef("")

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      const viewport = viewportRef.current
      if (viewport) {
        if (behavior === "smooth" && typeof viewport.scrollTo === "function") {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior })
        } else {
          viewport.scrollTop = viewport.scrollHeight
        }
      }
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
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "auto"
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 44), 144)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > 144 ? "auto" : "hidden"
  }, [body])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
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
          const shouldStick =
            incoming.sender_id === currentUserId || nearBottom(viewportRef.current)

          setMessages((current) => mergeMessages(current, [incoming]))

          if (incoming.message_type === "story_reply") {
            void loadRealtimeMessageAction(chatId, incoming.id)
              .then((hydrated) => {
                if (!cancelled && hydrated) {
                  setMessages((current) => mergeMessages(current, [hydrated]))
                }
              })
              .catch(() => {
                // Keep the reply body visible if Story context cannot be loaded.
              })
          }

          if (shouldStick) {
            setNewMessageCount(0)
            scrollToBottom(incoming.sender_id === currentUserId ? "auto" : "smooth")
          } else if (incoming.sender_id !== currentUserId) {
            setNewMessageCount((count) => count + 1)
          }

          if (incoming.sender_id !== currentUserId) {
            void markRead()
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
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

  function handleViewportScroll() {
    const viewport = viewportRef.current
    if (!viewport) return

    if (nearBottom(viewport, 72)) {
      setNewMessageCount(0)
    }

    if (viewport.scrollTop < 96 && hasMore && !loadingOlder) {
      void handleLoadOlder()
    }
  }

  function replacePreviewUrl(file: File) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const nextUrl = URL.createObjectURL(file)
    previewUrlRef.current = nextUrl
    setImagePreviewUrl(nextUrl)
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return

    if (!isChatImageMimeType(file.type)) {
      setSendError("დაშვებულია JPG, PNG ან WEBP ფოტო.")
      event.target.value = ""
      return
    }

    if (file.size < 1 || file.size > CHAT_IMAGE_MAX_BYTES) {
      setSendError("ფოტო მაქსიმუმ 8 MB უნდა იყოს.")
      event.target.value = ""
      return
    }

    setSendError("")
    setSelectedImage(file)
    replacePreviewUrl(file)
  }

  function clearSelectedImage() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ""
    }
    setImagePreviewUrl("")
    setSelectedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if ((!trimmed && !selectedImage) || sending || !canSend) return

    const clientRequestId = requestIdRef.current || crypto.randomUUID()
    requestIdRef.current = clientRequestId
    setSending(true)
    setSendError("")

    let result: Awaited<ReturnType<typeof sendChatMessageAction>>

    if (selectedImage) {
      const preparation = await prepareChatImageUploadAction({
        chatId,
        mimeType: selectedImage.type,
        size: selectedImage.size,
      })

      if (!preparation.ok) {
        setSendError(preparation.message)
        setSending(false)
        return
      }

      const { error: uploadError } = await supabase.storage
        .from(CHAT_IMAGE_BUCKET)
        .uploadToSignedUrl(preparation.path, preparation.token, selectedImage, {
          contentType: selectedImage.type,
        })

      if (uploadError) {
        await abortChatImageUploadAction({ chatId, path: preparation.path })
        setSendError("ფოტოს ატვირთვა ვერ მოხერხდა. სცადე ხელახლა.")
        setSending(false)
        return
      }

      result = await sendChatImageMessageAction({
        chatId,
        body: trimmed,
        path: preparation.path,
        mimeType: selectedImage.type,
        size: selectedImage.size,
        clientRequestId,
      })
    } else {
      result = await sendChatMessageAction({
        chatId,
        body: trimmed,
        clientRequestId,
      })
    }

    if (!result.ok) {
      setSendError(result.message)
      setSending(false)
      return
    }

    setMessages((current) => mergeMessages(current, [result.message]))
    setBody("")
    clearSelectedImage()
    requestIdRef.current = crypto.randomUUID()
    setSending(false)
    setNewMessageCount(0)
    scrollToBottom()
    void markRead()
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return
    }

    event.preventDefault()
    if (!sending && canSend && (body.trim() || selectedImage)) {
      formRef.current?.requestSubmit()
    }
  }

  return (
    <section
      aria-labelledby="chat-thread-title"
      className="flex h-full min-h-0 flex-col bg-white"
    >
      <h2 id="chat-thread-title" className="sr-only">
        დიალოგი: {otherPartyLabel}
      </h2>

      <div className="relative min-h-0 flex-1">
        <div
          ref={viewportRef}
          onScroll={handleViewportScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label={`${otherPartyLabel}-თან შეტყობინებები`}
          className="h-full touch-pan-y overscroll-contain overflow-y-auto px-3 py-4 sm:px-5"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col">
            {hasMore ? (
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleLoadOlder()}
                  disabled={loadingOlder}
                  className="rounded-full bg-surface-alt px-4 py-2 text-xs font-bold text-text-soft transition hover:text-text disabled:opacity-60"
                >
                  {loadingOlder ? "იტვირთება…" : "ძველი შეტყობინებების ჩატვირთვა"}
                </button>
              </div>
            ) : messages.length > 0 ? (
              <p className="mb-4 text-center text-[11px] font-semibold text-text-soft">
                მიმოწერის დასაწყისი
              </p>
            ) : null}

            {olderError ? (
              <div className="mb-4 flex flex-col items-center gap-2">
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {olderError}
                </p>
                <button
                  type="button"
                  onClick={() => void handleLoadOlder()}
                  className="text-xs font-black text-brand underline"
                >
                  ხელახლა ცდა
                </button>
              </div>
            ) : null}

            {messages.length > 0 ? (
              messages.map((message, index) => {
                const mine = message.sender_id === currentUserId
                const previous = messages[index - 1]
                const grouped =
                  Boolean(previous) && previous.sender_id === message.sender_id
                const imageUrl = `/api/chats/media/${encodeURIComponent(message.id)}`
                const showImageCaption =
                  message.message_type === "image" && message.body !== "📷 ფოტო"

                return (
                  <article
                    key={message.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"} ${
                      grouped ? "mt-1" : "mt-3"
                    }`}
                    aria-label={
                      mine
                        ? "შენი შეტყობინება"
                        : `${otherPartyLabel}-ის შეტყობინება`
                    }
                  >
                    <div
                      className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 sm:max-w-[72%] ${
                        mine
                          ? "rounded-br-md bg-brand text-white"
                          : "rounded-bl-md bg-surface-alt text-text"
                      }`}
                    >
                      <span className="sr-only">
                        {mine ? "შენ დაწერე:" : `${otherPartyLabel} წერს:`}
                      </span>

                      {message.message_type === "story_reply" ? (
                        <div
                          className={`mb-2 rounded-xl border px-3 py-2 text-xs ${
                            mine
                              ? "border-white/25 bg-white/10"
                              : "border-line bg-white"
                          }`}
                        >
                          <p className="font-black">Story პასუხი</p>
                          {message.story_context?.available ? (
                            <>
                              {message.story_context.caption ? (
                                <p className="mt-1 line-clamp-2 opacity-80">
                                  {message.story_context.caption}
                                </p>
                              ) : null}
                              {message.story_context.linkedListingSlug ? (
                                <a
                                  href={`/listing/${message.story_context.linkedListingSlug}`}
                                  className="mt-1 inline-block font-bold underline"
                                >
                                  ნივთის ნახვა
                                </a>
                              ) : null}
                            </>
                          ) : (
                            <p className="mt-1 opacity-75">
                              Story აღარ არის ხელმისაწვდომი
                            </p>
                          )}
                        </div>
                      ) : null}

                      {message.message_type === "image" ? (
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-xl bg-black/5"
                          aria-label="ფოტოს სრულ ზომაზე გახსნა"
                        >
                          <Image
                            src={imageUrl}
                            alt="ჩათში გაგზავნილი ფოტო"
                            width={720}
                            height={720}
                            unoptimized
                            className="max-h-[420px] w-auto max-w-full object-contain"
                          />
                        </a>
                      ) : null}

                      {message.message_type !== "image" || showImageCaption ? (
                        <p className={`${message.message_type === "image" ? "mt-2" : ""} whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-5`}>
                          {message.body}
                        </p>
                      ) : null}
                      <time
                        suppressHydrationWarning
                        dateTime={message.created_at}
                        className={`mt-1.5 block text-right text-[10px] ${
                          mine ? "text-white/70" : "text-text-soft"
                        }`}
                      >
                        {formatBubbleTimestamp(message.created_at)}
                      </time>
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="my-auto rounded-2xl border border-dashed border-line bg-surface-alt px-5 py-8 text-center text-sm leading-6 text-text-soft">
                შეტყობინებები ჯერ არ არის.
              </div>
            )}
          </div>
        </div>

        {newMessageCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              setNewMessageCount(0)
              scrollToBottom("smooth")
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-text px-4 py-2 text-xs font-black text-white shadow-lg"
          >
            {newMessageCount === 1
              ? "ახალი შეტყობინება ↓"
              : `${newMessageCount} ახალი შეტყობინება ↓`}
          </button>
        ) : null}
      </div>

      <form
        ref={formRef}
        onSubmit={handleSend}
        className="sticky bottom-0 z-20 shrink-0 border-t border-line bg-white/98 px-3 pt-3 backdrop-blur sm:px-5"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {canSend ? (
          <div className="mx-auto w-full max-w-3xl">
            {selectedImage && imagePreviewUrl ? (
              <div className="mb-2 flex items-center gap-3 rounded-2xl border border-line bg-surface-alt p-2">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
                  <Image
                    src={imagePreviewUrl}
                    alt="გასაგზავნი ფოტოს წინასწარი ნახვა"
                    width={64}
                    height={64}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-text">{selectedImage.name}</p>
                  <p className="mt-0.5 text-[11px] text-text-soft">{formatImageSize(selectedImage.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  disabled={sending}
                  aria-label="არჩეული ფოტოს მოშორება"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-soft transition hover:bg-white hover:text-text disabled:opacity-50"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2">
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label="ფოტოს დამატება"
                title="ფოტოს დამატება"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <circle cx="9" cy="10" r="2" />
                  <path d="m21 15-4.5-4.5L7 20" />
                </svg>
              </button>

              <label htmlFor="chat-message-body" className="sr-only">
                შეტყობინება
              </label>
              <textarea
                ref={textareaRef}
                id="chat-message-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                onFocus={() => scrollToBottom("smooth")}
                maxLength={CHAT_MESSAGE_MAX_LENGTH}
                rows={1}
                enterKeyHint="send"
                aria-describedby="chat-message-feedback"
                placeholder={selectedImage ? "დაამატე წარწერა…" : "დაწერე შეტყობინება…"}
                className="min-h-11 max-h-36 flex-1 resize-none rounded-2xl border border-line bg-surface-alt px-4 py-2.5 text-sm leading-5 text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand-soft"
              />
              <button
                type="submit"
                disabled={sending || (!body.trim() && !selectedImage)}
                aria-label={selectedImage ? "ფოტოს გაგზავნა" : "გაგზავნა"}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <span className="text-[10px] font-black">...</span>
                ) : (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 fill-none stroke-current"
                    strokeWidth="2"
                  >
                    <path d="m4 4 16 8-16 8 3-8-3-8Z" />
                    <path d="M7 12h13" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ) : (
          <p className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            ამ განცხადების მიმდინარე სტატუსზე მიმოწერის ისტორია ხელმისაწვდომია, მაგრამ ახალი შეტყობინების გაგზავნა შეზღუდულია.
          </p>
        )}

        <div
          id="chat-message-feedback"
          role={sendError ? "alert" : "status"}
          aria-live="polite"
          className={
            sendError
              ? "mx-auto mt-2 max-w-3xl text-sm font-semibold text-red-700"
              : "sr-only"
          }
        >
          {sendError || (sending ? "შეტყობინება იგზავნება." : "")}
        </div>
      </form>
    </section>
  )
}
