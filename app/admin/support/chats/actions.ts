"use server"

import { revalidatePath } from "next/cache"
import { requireAdminUser } from "@/lib/auth"
import { isChatUuid, validateChatMessageBody, CHAT_MESSAGE_PAGE_SIZE } from "@/lib/chats"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ChatMessage, ChatMessageCursor } from "@/types/chat"

type AdminSupportMessageRpcRow = {
  message_id: string
  message_body: string
  message_created_at: string
  recipient_id: string
}

export type AdminSupportSendResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; message: string }

export type AdminSupportLoadResult =
  | { ok: true; messages: ChatMessage[]; hasMore: boolean }
  | { ok: false; message: string }

function supportErrorMessage(raw?: string | null) {
  const value = String(raw ?? "").toLowerCase()
  if (value.includes("not_authenticated")) return "სესია დასრულებულია. ხელახლა შედი ანგარიშში."
  if (value.includes("not_authorized")) return "Support Inbox-ზე წვდომა არ გაქვს."
  if (value.includes("conversation_not_found")) return "Support მიმოწერა ვერ მოიძებნა."
  if (value.includes("message_empty")) return "დაწერე შეტყობინება."
  if (value.includes("message_too_long")) return "შეტყობინება მაქსიმუმ 2000 სიმბოლო უნდა იყოს."
  if (value.includes("message_rate_limited")) return "ძალიან ბევრი შეტყობინება გაიგზავნა. ცოტა ხანში სცადე ხელახლა."
  return "შეტყობინების გაგზავნა ვერ მოხერხდა. სცადე ხელახლა."
}

function compactText(value: string, max = 180) {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export async function sendAdminSupportMessageAction(input: {
  chatId: string
  body: string
  clientRequestId: string
}): Promise<AdminSupportSendResult> {
  if (!isChatUuid(input?.chatId) || !isChatUuid(input?.clientRequestId)) {
    return { ok: false, message: "მოთხოვნის მონაცემები არასწორია." }
  }

  const validation = validateChatMessageBody(input?.body)
  if (!validation.ok) return { ok: false, message: validation.message }

  const { supabase, user } = await requireAdminUser("/admin/support/chats")
  const { data, error } = await supabase
    .rpc("admin_send_support_message", {
      p_chat_id: input.chatId,
      p_body: validation.body,
      p_client_request_id: input.clientRequestId,
    })
    .single()

  const row = data as AdminSupportMessageRpcRow | null
  if (error || !row?.message_id || !row.recipient_id) {
    return { ok: false, message: supportErrorMessage(error?.message) }
  }

  const admin = createAdminClient()
  const { error: notificationError } = await admin
    .from("notifications")
    .insert({
      user_id: row.recipient_id,
      type: "chat_message",
      title: "ახალი შეტყობინება",
      body: `SamoSell Help: ${compactText(row.message_body)}`,
      href: `/dashboard/chats/${input.chatId}`,
      actor_id: user.id,
      chat_id: input.chatId,
      event_key: `support_admin_message:${row.message_id}`,
      metadata: {
        message_id: row.message_id,
        official_support: true,
        admin_support_reply: true,
      },
    })

  if (notificationError && notificationError.code !== "23505") {
    console.error("[admin-support] user notification failed", notificationError.message)
  }

  revalidatePath("/admin")
  revalidatePath("/admin/support/chats")
  revalidatePath(`/admin/support/chats/${input.chatId}`)
  revalidatePath("/dashboard/notifications")
  revalidatePath(`/dashboard/chats/${input.chatId}`)

  return {
    ok: true,
    message: {
      id: row.message_id,
      chat_id: input.chatId,
      sender_id: user.id,
      body: row.message_body,
      created_at: row.message_created_at,
      message_type: "text",
    },
  }
}

export async function markAdminSupportChatReadAction(chatId: string) {
  if (!isChatUuid(chatId)) return { ok: false as const }
  const { supabase } = await requireAdminUser("/admin/support/chats")
  const { data, error } = await supabase.rpc("admin_mark_support_chat_read", {
    p_chat_id: chatId,
  })

  if (error || data !== true) return { ok: false as const }

  revalidatePath("/admin")
  revalidatePath("/admin/support/chats")
  revalidatePath(`/admin/support/chats/${chatId}`)
  return { ok: true as const }
}

export async function loadOlderAdminSupportMessagesAction(
  chatId: string,
  cursor: ChatMessageCursor,
): Promise<AdminSupportLoadResult> {
  const beforeDate = new Date(cursor?.createdAt ?? "")
  if (
    !isChatUuid(chatId) ||
    !isChatUuid(cursor?.id) ||
    Number.isNaN(beforeDate.getTime())
  ) {
    return { ok: false, message: "ძველი შეტყობინებების მოთხოვნა არასწორია." }
  }

  const { supabase } = await requireAdminUser("/admin/support/chats")
  const { data: supportChat, error: chatError } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("chat_type", "support")
    .maybeSingle()

  if (chatError || !supportChat) {
    return { ok: false, message: "Support მიმოწერა ვერ მოიძებნა." }
  }

  const before = beforeDate.toISOString()
  const { data, error } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, body, created_at, message_type, story_id")
    .eq("chat_id", chatId)
    .or(`created_at.lt.${before},and(created_at.eq.${before},id.lt.${cursor.id})`)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_MESSAGE_PAGE_SIZE + 1)

  if (error) return { ok: false, message: "ძველი შეტყობინებები ვერ ჩაიტვირთა." }

  const rows = (data ?? []) as ChatMessage[]
  const hasMore = rows.length > CHAT_MESSAGE_PAGE_SIZE
  return {
    ok: true,
    messages: rows.slice(0, CHAT_MESSAGE_PAGE_SIZE).reverse(),
    hasMore,
  }
}
