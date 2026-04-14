"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/auth"
import { humanizeSupabaseError } from "@/lib/listings"
import { enforceRateLimit } from "@/lib/rate-limit"

function safeNextPath(value: string, fallback = "/catalog") {
  return value && value.startsWith("/") ? value : fallback
}

export async function submitListingReportAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const sellerId = String(formData.get("sellerId") || "")
  const listingSlug = String(formData.get("listingSlug") || "")
  const reason = String(formData.get("reason") || "other")
  const details = String(formData.get("details") || "").trim()
  const nextPath = safeNextPath(String(formData.get("nextPath") || `/listing/${listingSlug}`), `/listing/${listingSlug}`)

  if (!listingId || !sellerId || !listingSlug) redirect(nextPath)

  const { supabase, user } = await requireAuthenticatedUser(nextPath)

  if (user.id === sellerId) redirect(`${nextPath}?report=own`)

  try {
    await enforceRateLimit(supabase, "listing_report")
  } catch (error) {
    redirect(`${nextPath}?report=${encodeURIComponent(humanizeSupabaseError(error instanceof Error ? error.message : ""))}`)
  }

  const { data: existing } = await supabase
    .from("listing_reports")
    .select("id")
    .eq("listing_id", listingId)
    .eq("reporter_id", user.id)
    .maybeSingle()

  const payload = {
    listing_id: listingId,
    reporter_id: user.id,
    seller_id: sellerId,
    reason,
    details,
    status: "open",
    moderation_note: null,
    reviewed_by: null,
    reviewed_at: null,
  }

  const { error } = existing?.id
    ? await supabase.from("listing_reports").update(payload).eq("id", existing.id).eq("reporter_id", user.id)
    : await supabase.from("listing_reports").insert(payload)

  if (error) redirect(`${nextPath}?report=${encodeURIComponent(humanizeSupabaseError(error.message))}`)

  revalidatePath(nextPath)
  revalidatePath("/dashboard/reports")
  revalidatePath("/admin")
  revalidatePath("/admin/reports")
  redirect(`${nextPath}?report=ok`)
}

export async function toggleBlockUserAction(formData: FormData) {
  const blockedId = String(formData.get("blockedId") || "")
  const nextPath = safeNextPath(String(formData.get("nextPath") || "/catalog"))
  if (!blockedId) redirect(nextPath)

  const { supabase, user } = await requireAuthenticatedUser(nextPath)
  if (user.id === blockedId) redirect(nextPath)

  const { data: existing } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", blockedId)
    .maybeSingle()

  if (existing?.id) {
    await supabase.from("user_blocks").delete().eq("id", existing.id).eq("blocker_id", user.id)
  } else {
    await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: blockedId })
  }

  revalidatePath(nextPath)
  revalidatePath("/dashboard/chats")
  revalidatePath("/dashboard/reports")
  redirect(nextPath)
}

export async function reviewListingReportAction(formData: FormData) {
  const reportId = String(formData.get("reportId") || "")
  const listingId = String(formData.get("listingId") || "")
  const sellerId = String(formData.get("sellerId") || "")
  const decision = String(formData.get("decision") || "")
  const moderationNote = String(formData.get("moderationNote") || "").trim()

  if (!reportId || !listingId || !sellerId || !decision) redirect("/admin/reports")

  const { supabase, user } = await requireAdminUser("/dashboard")

  let reportStatus = "reviewing"
  if (decision === "resolved") reportStatus = "resolved"
  if (decision === "dismissed") reportStatus = "dismissed"
  if (decision === "hide_listing") reportStatus = "resolved"
  if (decision === "suspend_seller") reportStatus = "resolved"

  const { error: reportError } = await supabase
    .from("listing_reports")
    .update({
      status: reportStatus,
      moderation_note: moderationNote || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId)

  if (reportError) redirect(`/admin/reports?flash=${encodeURIComponent(humanizeSupabaseError(reportError.message))}`)

  if (decision === "hide_listing") {
    await supabase.from("listings").update({ status: "archived" }).eq("id", listingId)
  }

  if (decision === "suspend_seller") {
    await supabase.from("profiles").update({ is_suspended: true }).eq("id", sellerId)

    await supabase.from("listings").update({ status: "archived" }).eq("seller_id", sellerId).eq("status", "active")
  }

  revalidatePath("/catalog")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/listings")
  revalidatePath("/dashboard/reports")
  revalidatePath("/admin")
  revalidatePath("/admin/reports")
  redirect(`/admin/reports?flash=${decision}`)
}

export async function restoreSellerAction(formData: FormData) {
  const sellerId = String(formData.get("sellerId") || "")
  if (!sellerId) redirect("/admin/reports")
  const { supabase } = await requireAdminUser("/dashboard")
  await supabase.from("profiles").update({ is_suspended: false }).eq("id", sellerId)
  revalidatePath("/admin")
  revalidatePath("/admin/reports")
  redirect("/admin/reports?flash=restored")
}
