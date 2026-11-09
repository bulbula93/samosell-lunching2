import "server-only"
import { unstable_cache } from "next/cache"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { normalizeFacebookGroupUrl } from "@/lib/facebook-community"

export const COMMUNITY_SETTINGS_TAG = "facebook-community-settings"
const readSettings = unstable_cache(async () => {
  const { data, error } = await createPublicServerClient().from("community_settings")
    .select("facebook_group_url").eq("singleton", true).abortSignal(AbortSignal.timeout(3000)).maybeSingle()
  if (error || !data) throw new Error("COMMUNITY_SETTINGS_UNAVAILABLE")
  return normalizeFacebookGroupUrl(data.facebook_group_url)
}, ["facebook-community-settings-v1"], { revalidate: 60, tags: [COMMUNITY_SETTINGS_TAG] })

/** Sharing remains usable before migration or during a settings outage. */
export async function getFacebookGroupUrl(): Promise<string | null> {
  try { return await readSettings() } catch { return null }
}

/** Preview/local sessions must never mutate the production database. */
export function communitySettingsWritesEnabled() {
  if (process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") return false
  if (process.env.VERCEL_ENV === "production") return true
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    return ["https:", "http:"].includes(url.protocol) && url.hostname !== "lxsvjzbiuewgwpajqrwr.supabase.co"
  } catch { return false }
}
