"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function safeHref(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/notifications"
  }
  return value.slice(0, 500)
}

export async function openNotificationAction(formData: FormData) {
  const notificationId = formData.get("notificationId")
  const href = safeHref(formData.get("href"))
  const { supabase } = await requireAuthenticatedUser("/dashboard/notifications")

  if (typeof notificationId === "string" && UUID_RE.test(notificationId)) {
    await supabase.rpc("mark_notification_read", { p_notification_id: notificationId })
  }

  revalidatePath("/dashboard/notifications")
  redirect(href)
}

export async function markNotificationReadAction(formData: FormData) {
  const notificationId = formData.get("notificationId")
  const { supabase } = await requireAuthenticatedUser("/dashboard/notifications")

  if (typeof notificationId === "string" && UUID_RE.test(notificationId)) {
    await supabase.rpc("mark_notification_read", { p_notification_id: notificationId })
  }

  revalidatePath("/dashboard/notifications")
}

export async function markAllNotificationsReadAction() {
  const { supabase } = await requireAuthenticatedUser("/dashboard/notifications")
  await supabase.rpc("mark_all_notifications_read")
  revalidatePath("/dashboard/notifications")
}
