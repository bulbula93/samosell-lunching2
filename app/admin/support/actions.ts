"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import { isUuid } from "@/lib/moderation"

const ACTIONS = new Set(["reviewing", "resolved", "closed", "reopen"])

function feedbackPath(kind: "ok" | "error", value: string) {
  const params = new URLSearchParams({ [kind]: value })
  return `/admin/support?${params.toString()}`
}

function errorMessage(raw: string) {
  const value = raw.toLowerCase()
  if (value.includes("not_authenticated")) return "მოქმედებისთვის ავტორიზაციაა საჭირო."
  if (value.includes("not_authorized")) return "ამ მოქმედების უფლება არ გაქვს."
  if (value.includes("support_ticket_not_found")) return "Support მოთხოვნა ვერ მოიძებნა."
  if (value.includes("invalid_support_transition")) return "ამ მოთხოვნაზე არჩეული სტატუსის ცვლილება აღარ არის დაშვებული."
  if (value.includes("invalid_support_action")) return "Support მოქმედება არასწორია."
  if (value.includes("admin_note_too_long")) return "Admin შენიშვნა ზედმეტად გრძელია."
  return "Support მოთხოვნის განახლება ვერ შესრულდა. სცადე ხელახლა."
}

function successMessage(action: string) {
  switch (action) {
    case "reviewing":
      return "Support მოთხოვნა გადავიდა დამუშავებაში."
    case "resolved":
      return "Support მოთხოვნა მონიშნულია მოგვარებულად."
    case "closed":
      return "Support მოთხოვნა დაიხურა."
    case "reopen":
      return "Support მოთხოვნა ხელახლა გაიხსნა."
    default:
      return "Support მოთხოვნა განახლდა."
  }
}

export async function adminSupportTicketAction(formData: FormData) {
  const ticketId = String(formData.get("ticketId") || "")
  const action = String(formData.get("decision") || "")
  const note = String(formData.get("adminNote") || "").trim()

  if (!isUuid(ticketId) || !ACTIONS.has(action) || note.length > 2000) {
    redirect(feedbackPath("error", "Support მოქმედების მონაცემები არასწორია."))
  }

  const { supabase } = await requireAdminUser("/dashboard")
  const { error } = await supabase.rpc("admin_manage_support_ticket", {
    p_ticket_id: ticketId,
    p_action: action,
    p_note: note,
  })

  if (error) {
    redirect(feedbackPath("error", errorMessage(error.message)))
  }

  revalidatePath("/admin")
  revalidatePath("/admin/support")
  revalidatePath("/admin/audit")
  revalidatePath("/admin/system")
  redirect(feedbackPath("ok", successMessage(action)))
}
