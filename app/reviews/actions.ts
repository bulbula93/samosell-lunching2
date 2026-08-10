"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuthenticatedUser } from "@/lib/auth"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { isValidListingSlug } from "@/lib/listing-page"
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
  const nextPath = getSafeAuthRedirectPath(fallback, "/catalog")
  const validation = validateReviewInput(
    formData.get("score"),
    formData.get("comment"),
  )

  if (!isUuid(listingId) || !validation.ok) {
    redirect(withSafeFeedback(nextPath, "review", validation.ok ? "error" : validation.error))
  }

  const { supabase } = await requireAuthenticatedUser(nextPath)
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
