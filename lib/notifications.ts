import { absoluteSiteUrl, sendTransactionalEmail } from "@/lib/email"
import { createAdminClient } from "@/lib/supabase/admin"

type NotifyChatMessageInput = {
  chatId: string
  messageId: string
  senderId: string
  body: string
  firstMessage: boolean
}

type ChatRow = {
  id: string
  buyer_id: string
  seller_id: string
  listing_id: string
}

type ListingRow = {
  id: string
  title: string
  slug: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  username: string | null
}

function compactText(value: string, max = 180) {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

async function sendFirstChatEmail(input: {
  recipientId: string
  senderLabel: string
  listingTitle: string
  body: string
  href: string
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(input.recipientId)
  const email = data.user?.email?.trim()
  if (error || !email) return

  const chatUrl = absoluteSiteUrl(input.href)
  const subject = `ახალი შეტყობინება — ${compactText(input.listingTitle, 80)}`
  const preview = compactText(input.body, 260)

  await sendTransactionalEmail({
    to: email,
    subject,
    text: `${input.senderLabel}-მა მოგწერა განცხადებაზე „${input.listingTitle}“.\n\n${preview}\n\nჩათის გახსნა: ${chatUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f5f8f7;padding:28px;color:#102927">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #d9e4e2;border-radius:18px;padding:28px">
          <div style="font-size:13px;font-weight:700;letter-spacing:.08em;color:#075a53">SAMOSELL</div>
          <h1 style="font-size:24px;line-height:1.25;margin:12px 0 8px">ახალი შეტყობინება გაქვს</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;color:#49615f">
            <strong>${escapeHtml(input.senderLabel)}</strong>-მა მოგწერა განცხადებაზე
            „${escapeHtml(input.listingTitle)}“.
          </p>
          <div style="border-radius:14px;background:#f3f7f6;padding:16px;font-size:15px;line-height:1.6;margin-bottom:20px">
            ${escapeHtml(preview)}
          </div>
          <a href="${escapeHtml(chatUrl)}" style="display:inline-block;background:#075a53;color:white;text-decoration:none;font-weight:700;border-radius:12px;padding:13px 18px">ჩათის გახსნა</a>
          <p style="font-size:12px;line-height:1.5;color:#78908e;margin:22px 0 0">ეს წერილი გამოგზავნილია მხოლოდ პირველი შეტყობინებისას, რომ ახალი დაინტერესებული მყიდველი არ გამოგრჩეს.</p>
        </div>
      </div>
    `,
  })
}

export async function notifyChatMessage(input: NotifyChatMessageInput) {
  const admin = createAdminClient()

  const { data: chatData, error: chatError } = await admin
    .from("chats")
    .select("id, buyer_id, seller_id, listing_id")
    .eq("id", input.chatId)
    .maybeSingle()

  const chat = chatData as ChatRow | null
  if (chatError || !chat) return
  if (input.senderId !== chat.buyer_id && input.senderId !== chat.seller_id) return

  const recipientId = input.senderId === chat.buyer_id ? chat.seller_id : chat.buyer_id
  if (recipientId === input.senderId) return

  const [{ data: listingData }, { data: senderData }] = await Promise.all([
    admin
      .from("listings")
      .select("id, title, slug")
      .eq("id", chat.listing_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, full_name, username")
      .eq("id", input.senderId)
      .maybeSingle(),
  ])

  const listing = listingData as ListingRow | null
  const sender = senderData as ProfileRow | null
  const senderLabel = sender?.full_name || sender?.username || "მომხმარებელი"
  const listingTitle = listing?.title || "განცხადება"
  const href = `/dashboard/chats/${chat.id}`
  const firstMessage = input.firstMessage && input.senderId === chat.buyer_id
  const title = firstMessage
    ? "ახალი დაინტერესებული მყიდველი"
    : "ახალი შეტყობინება"
  const body = firstMessage
    ? `${senderLabel}-მა მოგწერა „${listingTitle}“-ზე: ${compactText(input.body)}`
    : `${senderLabel}: ${compactText(input.body)}`

  const { data: inserted, error: insertError } = await admin
    .from("notifications")
    .insert({
      user_id: recipientId,
      type: firstMessage ? "chat_started" : "chat_message",
      title,
      body,
      href,
      actor_id: input.senderId,
      listing_id: chat.listing_id,
      chat_id: chat.id,
      event_key: `chat_message:${input.messageId}`,
      metadata: {
        message_id: input.messageId,
        first_message: firstMessage,
      },
    })
    .select("id")
    .maybeSingle()

  if (insertError) {
    if (insertError.code === "23505") return
    console.error("[notifications] chat notification insert failed", insertError.message)
    return
  }
  if (!inserted) return

  if (firstMessage) {
    await sendFirstChatEmail({
      recipientId,
      senderLabel,
      listingTitle,
      body: input.body,
      href,
    })
  }
}
