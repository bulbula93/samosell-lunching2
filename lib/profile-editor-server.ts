import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { EMPTY_EDITABLE_PROFILE, type EditableProfile } from "@/lib/profile-editor"
import { normalizeStoreHero } from "@/lib/store-hero"

export async function loadEditableProfile(supabase: SupabaseClient, userId: string): Promise<EditableProfile> {
  const { data, error } = await supabase.from("profiles")
    .select("username, full_name, bio, city, avatar_url, seller_type, store_logo_url, store_banner_url, store_phone, store_whatsapp, store_telegram, store_instagram, store_facebook, store_website, store_hours, store_address, store_map_url, tiktok_username, tiktok_live_until")
    .eq("id", userId).maybeSingle()
  // Never substitute a blank form for an existing profile that failed to load.
  if (error) throw new Error("პროფილის ჩატვირთვა ვერ მოხერხდა — განაახლე გვერდი და სცადე ხელახლა")

  const heroResponse = data?.seller_type === "store"
    ? await supabase.from("profiles").select("store_hero").eq("id", userId).maybeSingle()
    : null
  if (heroResponse?.error && !["42703", "PGRST204"].includes(heroResponse.error.code)) {
    throw new Error("მაღაზიის ტექსტების ჩატვირთვა ვერ მოხერხდა — სცადე ხელახლა")
  }

  return {
    ...EMPTY_EDITABLE_PROFILE,
    ...Object.fromEntries(Object.entries(data ?? {}).map(([key, value]) => [key, value ?? ""])),
    store_hero: normalizeStoreHero(heroResponse?.data?.store_hero),
  }
}
