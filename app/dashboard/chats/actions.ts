"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"
import {
  CHAT_MESSAGE_PAGE_SIZE,
  chatErrorMessage,
  isChatUuid,
  validateChatMessageBody,
} from "@/lib/chats"
import { isValidListingSlug } from "@/lib/listing-page"
import { notifyChatMessage } from "@/lib/notifications"
import { createClient } from "@/lib/supabase/server"
import type { ChatMessage, ChatMessageCursor } from "@/types/chat"

export type StartChatState = {
  ok: false
  message: string
}

export type SendChatMessageResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; code: "unauthorized" | "invalid" | "not_found" | "server_error"; message: string }

export type LoadOlderMessagesResult =
  | { ok: true; messages: ChatMessage[]; hasMore: boolean }
  | { ok: false; code: "unauthorized" | "invalid" | "not_found" | "server_error"; message: string }

type AuthenticatedChatContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string }
}

type MessageRpcRow = {
  message_id: string
  message_body: string
  message_created_at: string
}

type StartMessageRpcRow = MessageRpcRow & {
  chat_id: string
}

async function getAuthenticatedChatContext(): Promise<AuthenticatedChatContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return { supabase, user: { id: user.id } }
}

async function canAccessChat(
  context: AuthenticatedChatContext,
  chatId: string,
) {
  const { data, error } = await context.supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .or(`buyer_id.eq.${context.user.id},seller_id.eq.${context.user.id}`)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

function buildMessage(
  row: MessageRpcRow,
  chatId: string,
  senderId: string,
): ChatMessage {
  return {
    id: row.message_id,
    chat_id: chatId,
    sender_id: senderId,
    body: row.message_body,
    created_at: row.message_created_at,
  }
}

async function createChatNotificationSafely(input: Parameters<typeof notifyChatMessage>[0]) {
  try {
    await notifyChatMessage(input)
  } catch (error) {
    console.error(
      "[notifications] chat notification failed",
      error instanceof Error ? error.message : "unknown error",
    )
  }
}

export async function startChatAction(
  _previousState: StartChatState,
  formData: FormData,
): Promise<StartChatState> {
  const listingId = formData.get("listingId")
  const listingSlugValue = formData.get("listingSlug")
  const clientRequestId = formData.get("clientRequestId")
  const messageValidation = validateChatMessageBody(formData.get("body"))
  const listingSlug =
    typeof listingSlugValue === "string" && isValidListingSlug(listingSlugValue)
      ? listingSlugValue
      : ""
  const returnPath = listingSlug ? `/listing/${listingSlug}` : "/catalog"

  const { supabase, user } = await requireAuthenticatedUser(returnPath)

  if (!isChatUuid(listingId) || !isChatUuid(clientRequestId)) {
    return {
      ok: false,
      message: "მოთხოვნის მონაცემები არასწორია. განაახლე გვერდი და სცადე თავიდან.",
    }
  }
  if (!messageValidation.ok) {
    return { ok: false, message: messageValidation.message }
  }

  const { data, error } = await supabase
    .rpc("start_chat_with_message", {
      p_listing_id: listingId,
      p_body: messageValidation.body,
      p_client_request_id: clientRequestId,
    })
    .single()

  const row = data as StartMessageRpcRow | null
  if (error || !row?.chat_id) {
    return { ok: false, message: chatErrorMessage(error?.message) }
  }

  await createChatNotificationSafely({
    chatId: row.chat_id,
    messageId: row.message_id,
    senderId: user.id,
    body: row.message_body,
    firstMessage: true,
  })

  revalidatePath("/dashboard/chats")
  revalidatePath("/dashboard/notifications")
  revalidatePath(`/dashboard/chats/${row.chat_id}`)
  redirect(`/dashboard/chats/${row.chat_id}`)
}

export async function sendChatMessageAction(
  input: {
    chatId: string
    body: string
    clientRequestId: string
  },
): Promise<SendChatMessageResult> {
  const context = await getAuthenticatedChatContext()
  if (!context) {
    return {
      ok: false,
      code: "unauthorized",
      message: "სესია დასრულებულია. ხელახლა შედი ანგარიშში.",
    }
  }

  if (!isChatUuid(input?.chatId) || !isChatUuid(input?.clientRequestId)) {
    return { ok: false, code: "invalid", message: "მოთხოვნის მონაცემები არასწორია." }
  }

  const messageValidation = validateChatMessageBody(input?.body)
  if (!messageValidation.ok) {
    return { ok: false, code: "invalid", message: messageValidation.message }
  }

  try {
    const { data, error } = await context.supabase
      .rpc("send_chat_message", {
        p_chat_id: input.chatId,
        p_body: messageValidation.body,
        p_client_request_id: input.clientRequestId,
      })
      .single()

    const row = data as MessageRpcRow | null
    if (error || !row?.message_id) {
      const message = chatErrorMessage(error?.message)
      const code = String(error?.message ?? "").includes("conversation_not_found")
        ? "not_found"
        : "server_error"
      return { ok: false, code, message }
    }

    await createChatNotificationSafely({
      chatId: input.chatId,
      messageId: row.message_id,
      senderId: context.user.id,
      body: row.message_body,
      firstMessage: false,
    })

    revalidatePath("/dashboard/chats")
    revalidatePath("/dashboard/notifications")
    revalidatePath(`/dashboard/chats/${input.chatId}`)

    return {
      ok: true,
      message: buildMessage(row, input.chatId, context.user.id),
    }
  } catch {
    return {
      ok: false,
      code: "server_error",
      message: chatErrorMessage(),
    }
  }
}

export async function loadOlderMessagesAction(
  chatId: string,
  cursor: ChatMessageCursor,
): Promise<LoadOlderMessagesResult> {
  const context = await getAuthenticatedChatContext()
  if (!context) {
    return {
      ok: false,
      code: "unauthorized",
      message: "სესია დასრულებულია. ხელახლა შედი ანგარიშში.",
    }
  }

  const beforeDate = new Date(cursor?.createdAt ?? "")
  if (
    !isChatUuid(chatId) ||
    !isChatUuid(cursor?.id) ||
    Number.isNaN(beforeDate.getTime())
  ) {
    return { ok: false, code: "invalid", message: "ძველი შეტყობინებების მოთხოვნა არასწორია." }
  }

  try {
    if (!(await canAccessChat(context, chatId))) {
      return {
        ok: false,
        code: "not_found",
        message: "მიმოწერა ვერ მოიძებნა ან მასზე წვდომა არ გაქვს.",
      }
    }

    const before = beforeDate.toISOString()
    const { data, error } = await context.supabase
      .from("messages")
      .select("id, chat_id, sender_id, body, created_at")
      .eq("chat_id", chatId)
      .or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${cursor.id})`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CHAT_MESSAGE_PAGE_SIZE + 1)

    if (error) throw error

    const rows = (data ?? []) as ChatMessage[]
    const hasMore = rows.length > CHAT_MESSAGE_PAGE_SIZE
    const messages = rows
      .slice(0, CHAT_MESSAGE_PAGE_SIZE)
      .reverse()

    return { ok: true, messages, hasMore }
  } catch {
    return {
      ok: false,
      code: "server_error",
      message: "ძველი შეტყობინებები ვერ ჩაიტვირთა. სცადე ხელახლა.",
    }
  }
}

export async function markChatReadAction(chatId: string) {
  const context = await getAuthenticatedChatContext()
  if (!context || !isChatUuid(chatId)) return { ok: false as const }

  const { data, error } = await context.supabase.rpc("mark_chat_read", {
    p_chat_id: chatId,
  })

  if (error || data !== true) return { ok: false as const }

  const { error: notificationError } = await context.supabase.rpc(
    "mark_chat_notifications_read",
    { p_chat_id: chatId },
  )
  if (notificationError) {
    console.error("[notifications] mark chat notifications read failed", notificationError.message)
  }

  revalidatePath("/dashboard/chats")
  revalidatePath("/dashboard/notifications")
  return { ok: true as const }
}

export async function updateChatVisibilityAction(formData: FormData) {
  const chatId = formData.get("chatId")
  const intent = formData.get("intent")
  const returnTo = formData.get("returnTo")

  if (!isChatUuid(chatId) || (intent !== "archive" && intent !== "restore")) {
    redirect("/dashboard/chats")
  }

  const threadPath = `/dashboard/chats/${chatId}`
  const nextPath = returnTo === "thread" && intent === "restore"
    ? threadPath
    : intent === "restore"
      ? "/dashboard/chats?show=archived"
      : "/dashboard/chats"
  const { supabase } = await requireAuthenticatedUser(nextPath)

  const { data, error } = await supabase.rpc("set_chat_archived", {
    p_chat_id: chatId,
    p_archived: intent === "archive",
  })

  if (error || data !== true) {
    const search = new URLSearchParams({
      flash: "მიმოწერის მდგომარეობა ვერ შეიცვალა. სცადე ხელახლა.",
    })
    redirect(`/dashboard/chats?${search.toString()}`)
  }

  revalidatePath("/dashboard/chats")
  revalidatePath(threadPath)
  redirect(nextPath)
}
