"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

function safeNextPath(value: string) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/catalog"
  }
  return value
}

function favoriteErrorPath(nextPath: string) {
  if (!nextPath.startsWith("/listing/")) return nextPath
  const url = new URL(nextPath, "https://samosell.ge")
  url.searchParams.set("favorite", "error")
  return `${url.pathname}${url.search}`
}

export async function toggleFavoriteAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const nextPath = safeNextPath(String(formData.get("nextPath") || "/catalog"))

  if (!listingId) {
    redirect(nextPath)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, slug, seller_id, status")
    .eq("id", listingId)
    .maybeSingle()

  if (
    listingError ||
    !listing ||
    listing.status !== "active" ||
    listing.seller_id === user.id
  ) {
    redirect(favoriteErrorPath(nextPath))
  }

  const { data: existingFavorite, error: existingError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle()

  if (existingError) {
    redirect(favoriteErrorPath(nextPath))
  }

  if (existingFavorite?.id) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existingFavorite.id)
      .eq("user_id", user.id)
    if (deleteError) redirect(favoriteErrorPath(nextPath))
  } else {
    const { error: insertError } = await supabase.from("favorites").insert({
      user_id: user.id,
      listing_id: listingId,
    })

    if (insertError && insertError.code !== "23505") {
      redirect(favoriteErrorPath(nextPath))
    }
  }

  revalidatePath("/")
  revalidatePath("/catalog")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/favorites")
  revalidatePath(nextPath)
  revalidatePath(`/listing/${listing.slug}`)
  redirect(nextPath)
}
