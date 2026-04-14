"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

function safeNextPath(value: string) {
  if (!value || !value.startsWith("/")) return "/catalog"
  return value
}

export async function toggleFavoriteAction(formData: FormData) {
  const listingId = String(formData.get("listingId") || "")
  const listingSlug = String(formData.get("listingSlug") || "")
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

  const { data: existingFavorite, error: existingError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle()

  if (existingError) {
    redirect(nextPath)
  }

  if (existingFavorite?.id) {
    await supabase.from("favorites").delete().eq("id", existingFavorite.id).eq("user_id", user.id)
  } else {
    const { error: insertError } = await supabase.from("favorites").insert({
      user_id: user.id,
      listing_id: listingId,
    })

    if (insertError && insertError.code !== "23505") {
      redirect(nextPath)
    }
  }

  revalidatePath("/")
  revalidatePath("/catalog")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/favorites")
  revalidatePath(nextPath)
  if (listingSlug) revalidatePath(`/listing/${listingSlug}`)
  redirect(nextPath)
}
