"use server"

import { revalidatePath } from "next/cache"
import { requireAuthenticatedUser } from "@/lib/auth"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readId(formData: FormData) {
  const value = formData.get("savedSearchId")
  return typeof value === "string" && UUID_RE.test(value) ? value : ""
}

function revalidateSavedSearches() {
  revalidatePath("/dashboard/saved-searches")
  revalidatePath("/catalog")
}

export async function toggleSavedSearchAction(formData: FormData) {
  const id = readId(formData)
  if (!id) return

  const active = formData.get("active") === "1"
  const { supabase } = await requireAuthenticatedUser("/dashboard/saved-searches")
  await supabase.rpc("set_saved_search_active", {
    p_saved_search_id: id,
    p_active: active,
  })
  revalidateSavedSearches()
}

export async function deleteSavedSearchAction(formData: FormData) {
  const id = readId(formData)
  if (!id) return

  const { supabase } = await requireAuthenticatedUser("/dashboard/saved-searches")
  await supabase.rpc("delete_saved_search", { p_saved_search_id: id })
  revalidateSavedSearches()
}
