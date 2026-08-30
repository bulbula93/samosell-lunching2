import { isValidSellerPhone, normalizeSellerPhone } from "@/lib/phone"

export type ProfileCompletionInput = {
  full_name?: string | null
  city?: string | null
  avatar_url?: string | null
  seller_type?: string | null
  store_logo_url?: string | null
  store_phone?: string | null
}

export type ProfileCompletionKey = "name" | "photo" | "city" | "phone"

export type ProfileCompletionItem = {
  key: ProfileCompletionKey
  label: string
  complete: boolean
  requiredForListing: boolean
}

export type ProfileCompletion = {
  percentage: number
  completedCount: number
  totalCount: number
  items: ProfileCompletionItem[]
  missing: ProfileCompletionItem[]
  blockingMissing: ProfileCompletionItem[]
  canPublishListing: boolean
}

function hasText(value?: string | null) {
  return Boolean(String(value ?? "").trim())
}

export function getProfileCompletion(profile: ProfileCompletionInput): ProfileCompletion {
  const hasName = hasText(profile.full_name)
  const hasCity = hasText(profile.city)
  const hasPhoto = hasText(profile.avatar_url)
    || (profile.seller_type === "store" && hasText(profile.store_logo_url))
  const hasPhone = isValidSellerPhone(normalizeSellerPhone(profile.store_phone ?? ""))

  const items: ProfileCompletionItem[] = [
    { key: "name", label: "სახელი", complete: hasName, requiredForListing: false },
    { key: "photo", label: "პროფილის ფოტო", complete: hasPhoto, requiredForListing: false },
    { key: "city", label: "ქალაქი", complete: hasCity, requiredForListing: false },
    { key: "phone", label: "ტელეფონის ნომერი", complete: hasPhone, requiredForListing: true },
  ]

  const completedCount = items.filter((item) => item.complete).length
  const missing = items.filter((item) => !item.complete)
  const blockingMissing = missing.filter((item) => item.requiredForListing)

  return {
    percentage: Math.round((completedCount / items.length) * 100),
    completedCount,
    totalCount: items.length,
    items,
    missing,
    blockingMissing,
    canPublishListing: blockingMissing.length === 0,
  }
}
