"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser, requireAuthenticatedUser } from "@/lib/auth"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import {
  isModerationDecision,
  isUuid,
  MODERATION_NOTE_MAX_LENGTH,
  moderationErrorMessage,
  type ReportKind,
  validateReportInput,
  withSafeFeedback,
} from "@/lib/moderation"

function getReportKind(value: string): ReportKind | null {
  return value === "listing" || value === "user" ? value : null
}

function revalidateModerationPaths(nextPath?: string) {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/reports")
  revalidatePath("/dashboard/chats")
  revalidatePath("/admin")
  revalidatePath("/admin/reports")

  if (nextPath) {
    const safePath = getSafeAuthRedirectPath(nextPath, "/catalog")
    revalidatePath(new URL(safePath, "https://samosell.local").pathname)
  }
}

export async function submitListingReportAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const listingSlug = String(formData.get("listingSlug") || "")
  const reason = String(formData.get("reason") || "")
  const details = String(formData.get("details") || "").trim()
  const fallback = listingSlug ? `/listing/${encodeURIComponent(listingSlug)}` : "/catalog"
  const nextPath = getSafeAuthRedirectPath(
    String(formData.get("nextPath") || fallback),
    fallback,
  )
  const validationError = validateReportInput("listing", reason, details)

  if (!isUuid(listingId) || validationError) {
    redirect(
      withSafeFeedback(
        nextPath,
        "report",
        validationError || "რეპორტის მონაცემები არასწორია.",
        fallback,
      ),
    )
  }

  const { supabase } = await requireAuthenticatedUser(nextPath)
  const { error } = await supabase.rpc("submit_listing_report", {
    p_listing_id: listingId,
    p_reason: reason,
    p_details: details,
  })

  if (error) {
    redirect(
      withSafeFeedback(
        nextPath,
        "report",
        moderationErrorMessage(error.message),
        fallback,
      ),
    )
  }

  revalidateModerationPaths(nextPath)
  redirect(withSafeFeedback(nextPath, "report", "ok", fallback))
}

export async function submitUserReportAction(formData: FormData) {
  const reportedUserId = String(formData.get("reportedUserId") || "")
  const contextListingId = String(formData.get("contextListingId") || "")
  const reason = String(formData.get("reason") || "")
  const details = String(formData.get("details") || "").trim()
  const nextPath = getSafeAuthRedirectPath(
    String(formData.get("nextPath") || "/catalog"),
    "/catalog",
  )
  const validationError = validateReportInput("user", reason, details)

  if (
    !isUuid(reportedUserId) ||
    (contextListingId && !isUuid(contextListingId)) ||
    validationError
  ) {
    redirect(
      withSafeFeedback(
        nextPath,
        "report",
        validationError || "რეპორტის მონაცემები არასწორია.",
      ),
    )
  }

  const { supabase } = await requireAuthenticatedUser(nextPath)
  const { error } = await supabase.rpc("submit_user_report", {
    p_reported_user_id: reportedUserId,
    p_reason: reason,
    p_details: details,
    p_context_listing_id: contextListingId || null,
  })

  if (error) {
    redirect(
      withSafeFeedback(
        nextPath,
        "report",
        moderationErrorMessage(error.message),
      ),
    )
  }

  revalidateModerationPaths(nextPath)
  redirect(withSafeFeedback(nextPath, "report", "user-ok"))
}

export async function toggleBlockUserAction(formData: FormData) {
  const blockedId = String(formData.get("blockedId") || "")
  const shouldBlock = String(formData.get("shouldBlock") || "") === "true"
  const nextPath = getSafeAuthRedirectPath(
    String(formData.get("nextPath") || "/catalog"),
    "/catalog",
  )

  if (!isUuid(blockedId)) {
    redirect(withSafeFeedback(nextPath, "safety", "მომხმარებელი ვერ მოიძებნა."))
  }

  const { supabase } = await requireAuthenticatedUser(nextPath)
  const { error } = await supabase.rpc("set_user_blocked", {
    p_blocked_id: blockedId,
    p_blocked: shouldBlock,
  })

  if (error) {
    redirect(
      withSafeFeedback(
        nextPath,
        "safety",
        moderationErrorMessage(error.message),
      ),
    )
  }

  revalidateModerationPaths(nextPath)
  redirect(
    withSafeFeedback(
      nextPath,
      "safety",
      shouldBlock ? "blocked" : "unblocked",
    ),
  )
}

export async function reviewModerationReportAction(formData: FormData) {
  const reportKind = getReportKind(String(formData.get("reportKind") || ""))
  const reportId = String(formData.get("reportId") || "")
  const decision = String(formData.get("decision") || "")
  const moderationNote = String(formData.get("moderationNote") || "").trim()
  const adminPath = "/admin/reports"

  if (
    !reportKind ||
    !isUuid(reportId) ||
    !isModerationDecision(decision) ||
    decision === "restore_user" ||
    moderationNote.length > MODERATION_NOTE_MAX_LENGTH
  ) {
    redirect(
      withSafeFeedback(
        adminPath,
        "flash",
        "მოდერაციის მონაცემები არასწორია.",
        adminPath,
      ),
    )
  }

  const { supabase } = await requireAdminUser("/dashboard")
  const { error } = await supabase.rpc("review_moderation_report", {
    p_report_kind: reportKind,
    p_report_id: reportId,
    p_decision: decision,
    p_moderation_note: moderationNote,
  })

  if (error) {
    redirect(
      withSafeFeedback(
        adminPath,
        "flash",
        moderationErrorMessage(error.message),
        adminPath,
      ),
    )
  }

  revalidateModerationPaths()
  revalidatePath("/catalog")
  redirect(withSafeFeedback(adminPath, "flash", decision, adminPath))
}

export async function restoreSellerAction(formData: FormData) {
  const reportKind = getReportKind(String(formData.get("reportKind") || ""))
  const reportId = String(formData.get("reportId") || "")
  const adminPath = "/admin/reports"

  if (!reportKind || !isUuid(reportId)) {
    redirect(
      withSafeFeedback(
        adminPath,
        "flash",
        "რეპორტი ვერ მოიძებნა.",
        adminPath,
      ),
    )
  }

  const { supabase } = await requireAdminUser("/dashboard")
  const { error } = await supabase.rpc("review_moderation_report", {
    p_report_kind: reportKind,
    p_report_id: reportId,
    p_decision: "restore_user",
    p_moderation_note: "",
  })

  if (error) {
    redirect(
      withSafeFeedback(
        adminPath,
        "flash",
        moderationErrorMessage(error.message),
        adminPath,
      ),
    )
  }

  revalidateModerationPaths()
  redirect(withSafeFeedback(adminPath, "flash", "restored", adminPath))
}
