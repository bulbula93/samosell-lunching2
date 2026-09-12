"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { chatErrorMessage, isChatUuid } from "@/lib/chats"

export async function openProfileChatAction(_previous: { message: string }, formData: FormData) {
  const recipientId = formData.get("recipientId")
  if (!isChatUuid(recipientId)) return { message: "მომხმარებელი ვერ მოიძებნა." }
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.is_anonymous) return { message: "ჩათის გასახსნელად შედი ანგარიშში." }
  const { data, error } = await supabase.rpc("open_profile_direct_chat", { p_recipient_id: recipientId })
  if (error || !isChatUuid(data)) return { message: chatErrorMessage(error?.message) }
  redirect(`/dashboard/chats/${data}`)
}
