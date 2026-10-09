"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { isValidListingSlug } from "@/lib/listing-page"
import { isChatUuid } from "@/lib/chats"
import { isUuid, withSafeFeedback } from "@/lib/moderation"
import {
  reviewErrorCode,
  validateReviewInput,
} from "@/lib/reviews"

export async function upsertListingReviewAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const listingSlug = String(formData.get("listingSlug") || "")
  const fallback = isValidListingSlug(listingSlug)
    ? `/listing/${encodeURIComponent(listingSlug)}`
    : "/catalog"
  const requestedChatId = String(formData.get("chatId") || "")
  const chatId = isChatUuid(requestedChatId) ? requestedChatId : null
  const validation = validateReviewInput(formData.get("score"), formData.get("comment"))

  // Keep ordinary listing-form validation immediate and backwards compatible.
  if (!chatId && (!isUuid(listingId) || !validation.ok)) {
    redirect(withSafeFeedback(fallback, "review", validation.ok ? "error" : validation.error))
  }

  const loginReturnPath = chatId ? `/dashboard/chats/${chatId}` : fallback
  const { supabase, user } = await requireAuthenticatedUser(loginReturnPath)

  // Never trust a chatId supplied by the form. The chat must belong to this
  // logged-in buyer and to the exact listing being reviewed.
  let nextPath = getSafeAuthRedirectPath(fallback, "/catalog")
  if (chatId) {
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .maybeSingle()
    if (chatError) throw new Error("REVIEW_CHAT_ACCESS_FAILED", { cause: chatError })
    if (!chat) redirect(withSafeFeedback(fallback, "review", "not-allowed"))
    nextPath = `/dashboard/chats/${chatId}`
  }

  if (!isUuid(listingId) || !validation.ok) {
    redirect(withSafeFeedback(nextPath, "review", validation.ok ? "error" : validation.error))
  }

  const { error } = await supabase.rpc("upsert_listing_review", {
    p_listing_id: listingId,
    p_score: validation.score,
    p_comment: validation.comment || null,
  })

  if (error) {
    redirect(withSafeFeedback(nextPath, "review", reviewErrorCode(error.message)))
  }

  revalidatePath(nextPath)
  revalidatePath("/seller/[username]", "page")
  redirect(withSafeFeedback(nextPath, "review", "saved"))
}
