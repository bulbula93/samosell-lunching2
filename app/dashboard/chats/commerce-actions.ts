"use server"

import { revalidatePath } from "next/cache"
import { isChatUuid } from "@/lib/chats"
import { enforceRateLimit } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"

export type ChatCommerceResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

function commerceErrorMessage(value?: string | null) {
  const message = String(value ?? "").toLowerCase()
  if (message.includes("not_authenticated")) return "სესია დასრულდა. თავიდან შედი ანგარიშში."
  if (message.includes("account_suspended")) return "ამ ანგარიშზე სავაჭრო მოქმედებები დროებით შეზღუდულია."
  if (message.includes("invalid_offer_amount")) return "შეთავაზებული ფასი უნდა იყოს 0-ზე მეტი და არ უნდა აღემატებოდეს განცხადების ფასს."
  if (message.includes("offer_rate_limited")) return "ახალი შეთავაზების გაგზავნამდე ცოტა ხანი დაელოდე."
  if (message.includes("buyer_message_required")) return "ფასის შეთავაზებამდე ჯერ მისწერე გამყიდველს ჩათში."
  if (message.includes("offer_already_resolved")) return "ეს შეთავაზება უკვე დამუშავებულია. განაახლე გვერდი."
  if (message.includes("offer_not_found")) return "შეთავაზება ვერ მოიძებნა ან მისი მართვის უფლება არ გაქვს."
  if (message.includes("reservation_not_found")) return "ამ მყიდველისთვის აქტიური ჯავშანი ვერ მოიძებნა."
  if (message.includes("reserved_for_other_buyer")) return "ნივთი სხვა მყიდველისთვისაა დაჯავშნილი."
  if (message.includes("listing_unavailable")) return "განცხადება ამ მოქმედებისთვის აღარ არის ხელმისაწვდომი."
  if (message.includes("invalid_reservation_buyer")) return "ამ მომხმარებლისთვის ნივთის დაჯავშნა ვერ მოხერხდა."
  if (message.includes("offer_not_allowed") || message.includes("reservation_not_allowed") || message.includes("sale_not_allowed")) {
    return "ამ ჩათში ამ მოქმედების შესრულების უფლება არ გაქვს."
  }
  return "მოქმედება ვერ შესრულდა. მონაცემები არ შეცვლილა — სცადე ხელახლა."
}

async function rateLimitedClient() {
  const supabase = await createClient()
  try {
    await enforceRateLimit(supabase, "chat_commerce")
  } catch (error) {
    return {
      supabase,
      error: error instanceof Error ? error.message : "ძალიან ბევრი მოთხოვნა გაიგზავნა. ცოტა ხანში სცადე ხელახლა.",
    }
  }
  return { supabase, error: "" }
}

function revalidateChat(chatId: string) {
  revalidatePath(`/dashboard/chats/${chatId}`)
  revalidatePath("/dashboard/chats")
  revalidatePath("/dashboard/listings")
  revalidatePath("/catalog")
}

export async function createChatOfferAction(input: {
  chatId: string
  amount: number
}): Promise<ChatCommerceResult> {
  const chatId = String(input?.chatId ?? "")
  const amount = Number(input?.amount)
  if (!isChatUuid(chatId) || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "შეთავაზების მონაცემები არასწორია." }
  }

  const { supabase, error: rateError } = await rateLimitedClient()
  if (rateError) return { ok: false, message: rateError }

  const { error } = await supabase.rpc("create_chat_offer", {
    p_chat_id: chatId,
    p_amount: amount,
  })
  if (error) return { ok: false, message: commerceErrorMessage(error.message) }

  revalidateChat(chatId)
  return { ok: true, message: "ფასის შეთავაზება გაიგზავნა." }
}

export async function respondChatOfferAction(input: {
  chatId: string
  offerId: string
  action: "accept" | "reject"
}): Promise<ChatCommerceResult> {
  const chatId = String(input?.chatId ?? "")
  const offerId = String(input?.offerId ?? "")
  const action = input?.action
  if (!isChatUuid(chatId) || !isChatUuid(offerId) || (action !== "accept" && action !== "reject")) {
    return { ok: false, message: "შეთავაზების მოქმედება არასწორია." }
  }

  const { supabase, error: rateError } = await rateLimitedClient()
  if (rateError) return { ok: false, message: rateError }

  const { error } = await supabase.rpc("respond_chat_offer", {
    p_offer_id: offerId,
    p_action: action,
  })
  if (error) return { ok: false, message: commerceErrorMessage(error.message) }

  revalidateChat(chatId)
  return {
    ok: true,
    message: action === "accept" ? "შეთავაზება მიიღე და ნივთი ამ მყიდველისთვის დაიჯავშნა." : "შეთავაზება უარყავი.",
  }
}

export async function reserveChatListingAction(chatIdInput: string): Promise<ChatCommerceResult> {
  const chatId = String(chatIdInput ?? "")
  if (!isChatUuid(chatId)) return { ok: false, message: "ჩათის იდენტიფიკატორი არასწორია." }

  const { supabase, error: rateError } = await rateLimitedClient()
  if (rateError) return { ok: false, message: rateError }

  const { error } = await supabase.rpc("reserve_chat_listing", { p_chat_id: chatId })
  if (error) return { ok: false, message: commerceErrorMessage(error.message) }

  revalidateChat(chatId)
  return { ok: true, message: "ნივთი ამ მყიდველისთვის დაიჯავშნა." }
}

export async function releaseChatReservationAction(chatIdInput: string): Promise<ChatCommerceResult> {
  const chatId = String(chatIdInput ?? "")
  if (!isChatUuid(chatId)) return { ok: false, message: "ჩათის იდენტიფიკატორი არასწორია." }

  const { supabase, error: rateError } = await rateLimitedClient()
  if (rateError) return { ok: false, message: rateError }

  const { error } = await supabase.rpc("release_chat_reservation", { p_chat_id: chatId })
  if (error) return { ok: false, message: commerceErrorMessage(error.message) }

  revalidateChat(chatId)
  return { ok: true, message: "ჯავშანი მოიხსნა და განცხადება ისევ აქტიურია." }
}

export async function completeChatSaleAction(chatIdInput: string): Promise<ChatCommerceResult> {
  const chatId = String(chatIdInput ?? "")
  if (!isChatUuid(chatId)) return { ok: false, message: "ჩათის იდენტიფიკატორი არასწორია." }

  const { supabase, error: rateError } = await rateLimitedClient()
  if (rateError) return { ok: false, message: rateError }

  const { data, error } = await supabase.rpc("complete_chat_sale", { p_chat_id: chatId })
  if (error) return { ok: false, message: commerceErrorMessage(error.message) }

  const payload = data as { listing_slug?: string } | null
  revalidateChat(chatId)
  if (payload?.listing_slug) revalidatePath(`/listing/${payload.listing_slug}`)
  return { ok: true, message: "ნივთი ამ მყიდველზე გაყიდულად მოინიშნა. შეფასების მოთხოვნაც გაიგზავნა." }
}
