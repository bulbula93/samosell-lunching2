import { normalizeStoreHero, type StoreHeroContent } from "@/lib/store-hero"

export type EditableProfile = {
  username: string
  full_name: string
  bio: string
  city: string
  avatar_url: string
  seller_type: string
  store_logo_url: string
  store_banner_url: string
  store_hero: StoreHeroContent
  store_phone: string
  store_whatsapp: string
  store_telegram: string
  store_instagram: string
  store_facebook: string
  store_website: string
  store_hours: string
  store_address: string
  store_map_url: string
  tiktok_username: string
  tiktok_live_until: string
}

export const EMPTY_EDITABLE_PROFILE: EditableProfile = {
  username: "", full_name: "", bio: "", city: "", avatar_url: "", seller_type: "individual",
  store_logo_url: "", store_banner_url: "", store_hero: normalizeStoreHero(null), store_phone: "",
  store_whatsapp: "", store_telegram: "", store_instagram: "", store_facebook: "", store_website: "",
  store_hours: "", store_address: "", store_map_url: "", tiktok_username: "", tiktok_live_until: "",
}
