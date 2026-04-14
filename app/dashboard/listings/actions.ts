"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { extractStoragePathFromPublicUrl, humanizeSupabaseError } from "@/lib/listings"

function buildRedirect(filter: string, result: string) {
  const search = new URLSearchParams()
  if (filter && filter !== "all") search.set("status", filter)
  search.set("flash", result)
  return `/dashboard/listings?${search.toString()}`
}

export async function updateListingStatusAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const intent = String(formData.get("intent") || "")
  const filter = String(formData.get("filter") || "all")
  if (!listingId || !intent) redirect(buildRedirect(filter, "error"))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  let payload: Record<string, string | null> = {}
  let result = "updated"
  switch (intent) {
    case "publish": payload = { status: "active", published_at: new Date().toISOString() }; result = "published"; break
    case "unpublish": payload = { status: "draft", published_at: null }; result = "draft"; break
    case "sold": payload = { status: "sold" }; result = "sold"; break
    case "archive": payload = { status: "archived" }; result = "archived"; break
    case "reactivate": payload = { status: "active", published_at: new Date().toISOString() }; result = "published"; break
    default: redirect(buildRedirect(filter, "error"))
  }

  const { error } = await supabase.from("listings").update(payload).eq("id", listingId).eq("seller_id", user.id)
  if (error) redirect(buildRedirect(filter, humanizeSupabaseError(error.message)))

  revalidatePath("/dashboard/listings")
  revalidatePath("/catalog")
  redirect(buildRedirect(filter, result))
}


export async function deleteListingAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const filter = String(formData.get("filter") || "all")
  if (!listingId) redirect(buildRedirect(filter, "error"))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, slug, cover_image_url")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .maybeSingle()

  if (listingError) redirect(buildRedirect(filter, humanizeSupabaseError(listingError.message)))
  if (!listing) redirect(buildRedirect(filter, "error"))

  const { data: listingImages, error: imagesError } = await supabase
    .from("listing_images")
    .select("image_url")
    .eq("listing_id", listingId)

  if (imagesError) redirect(buildRedirect(filter, humanizeSupabaseError(imagesError.message)))

  const storagePaths = Array.from(
    new Set(
      [listing.cover_image_url, ...(listingImages ?? []).map((image) => image.image_url)]
        .filter((url): url is string => Boolean(url))
        .map((url) => extractStoragePathFromPublicUrl(url))
        .filter((path): path is string => Boolean(path))
    )
  )

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("listing-images").remove(storagePaths)
    if (storageError) redirect(buildRedirect(filter, humanizeSupabaseError(storageError.message)))
  }

  const { error: deleteError } = await supabase.from("listings").delete().eq("id", listingId).eq("seller_id", user.id)
  if (deleteError) redirect(buildRedirect(filter, humanizeSupabaseError(deleteError.message)))

  revalidatePath("/dashboard/listings")
  revalidatePath("/catalog")
  if (listing.slug) revalidatePath(`/listing/${listing.slug}`)

  redirect(buildRedirect(filter, "deleted"))
}
