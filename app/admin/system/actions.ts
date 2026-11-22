"use server"

import { revalidatePath, updateTag } from "next/cache"
import { redirect } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import { normalizeFacebookGroupUrl } from "@/lib/facebook-community"
import { COMMUNITY_SETTINGS_TAG, communitySettingsWritesEnabled } from "@/lib/facebook-community-server"

export async function saveFacebookGroupAction(formData: FormData) {
  const { supabase } = await requireAdminUser("/dashboard")
  if (!communitySettingsWritesEnabled()) redirect("/admin/system?community=read_only")
  const raw = String(formData.get("facebook_group_url") ?? "").trim()
  const url = normalizeFacebookGroupUrl(raw)
  if (raw && !url) redirect("/admin/system?community=invalid_url")
  const { data, error } = await supabase.from("community_settings").update({ facebook_group_url: url })
    .eq("singleton", true).select("facebook_group_url").maybeSingle()
  if (error || !data) redirect("/admin/system?community=unavailable")
  updateTag(COMMUNITY_SETTINGS_TAG)
  revalidatePath("/admin/system")
  redirect("/admin/system?community=saved")
}
