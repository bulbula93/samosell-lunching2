import type { SupabaseClient } from "@supabase/supabase-js"
import { isListingImageMimeType } from "@/lib/listing-form"

export const MAX_LISTING_IMAGES = 8
export const MAX_IMAGE_FILE_SIZE_MB = 7
export const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024

const GEORGIAN_TRANSLITERATION: Record<string, string> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t",
  ი: "i", კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh",
  რ: "r", ს: "s", ტ: "t", უ: "u", ფ: "p", ქ: "k", ღ: "gh", ყ: "q",
  შ: "sh", ჩ: "ch", ც: "ts", ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh",
  ჯ: "j", ჰ: "h",
}

export function slugify(value: string) {
  return value
    .replace(/[ა-ჰ]/g, (character) => GEORGIAN_TRANSLITERATION[character] ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function generateUniqueListingSlug(
  supabase: SupabaseClient,
  title: string,
  stableListingId: string,
) {
  const compactId = stableListingId.replace(/-/g, "").toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(compactId)) {
    throw new Error("A valid stable listing ID is required for slug generation.")
  }

  const baseSlug = slugify(title).slice(0, 120).replace(/-+$/g, "") || "listing"
  for (const suffixLength of [8, 12, 16, 32]) {
    const candidate = `${baseSlug}-${compactId.slice(0, suffixLength)}`
    const query = supabase.from("listings").select("id").eq("slug", candidate).limit(1)
    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) return candidate
  }

  throw new Error("Unable to generate a unique listing slug.")
}

export function validateImageFile(file: File) {
  if (!isListingImageMimeType(file.type)) return "ატვირთე მხოლოდ JPEG, PNG ან WEBP სურათი."
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) return `ფაილი ძალიან დიდია. მაქსიმალური ზომაა ${MAX_IMAGE_FILE_SIZE_MB}MB.`
  if (file.size === 0) return "ცარიელი ფაილის ატვირთვა შეუძლებელია."
  return null
}

export function humanizeSupabaseError(message?: string | null) {
  if (!message) return "ოპერაცია ვერ შესრულდა."
  if (message.includes("duplicate key value") || message.includes("unique constraint")) return "ასეთი ჩანაწერი უკვე არსებობს. სცადე სხვა მნიშვნელობა."
  if (message.includes("row-level security") || message.includes("permission denied")) return "ამის გაკეთების უფლება არ გაქვს. თავიდან შეხვდი ანგარიშში და სცადე ხელახლა."
  if (message.includes("JWT") || message.includes("session")) return "სესია მოძველდა. თავიდან შეხვდი სისტემაში."
  if (
    message.includes("buyer_last_read_at") ||
    message.includes("seller_last_read_at") ||
    message.includes("buyer_archived_at") ||
    message.includes("seller_archived_at")
  ) {
    return "ჩათის ახალი ველები ბაზაში ჯერ არ არის დამატებული. Supabase-ში გაუშვი chat migration-ები."
  }
  if (message.includes("chat_threads") || message.includes('relation "public.chat_threads" does not exist')) {
    return "chat_threads view აკლია. Supabase-ში გაუშვი chat migration-ები."
  }
  return message
}

export function extractStoragePathFromPublicUrl(url: string, bucket = "listing-images") {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length))
}

export function listingStatusLabel(status?: string | null) {
  switch (status) {
    case "draft": return "დრაფტი"
    case "pending_review": return "მოდერაციაში"
    case "active": return "აქტიური"
    case "reserved": return "დარეზერვებული"
    case "sold": return "გაყიდული"
    case "rejected": return "უარყოფილი"
    case "archived": return "არქივი"
    default: return status || "უცნობი"
  }
}

export function conditionLabel(condition?: string | null) {
  switch (condition) {
    case "new": return "ახალი"
    case "like_new": return "თითქმის ახალი"
    case "good": return "კარგი"
    case "fair": return "საშუალო"
    default: return condition || "—"
  }
}

export function genderLabel(gender?: string | null) {
  switch (gender) {
    case "women": return "ქალები"
    case "men": return "კაცები"
    case "unisex": return "უნისექსი"
    case "kids": return "ბავშვები"
    default: return gender || "—"
  }
}

export function formatPrice(value: number | string, currency = "GEL") {
  const amount = typeof value === "string" ? Number(value) : value
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const hasFraction = Math.round(safeAmount * 100) % 100 !== 0
  const formatted = new Intl.NumberFormat("ka-GE", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safeAmount)

  return `${formatted} ${currency === "GEL" ? "₾" : currency}`
}

export function formatPublishedDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

export function relativePublishedLabel(value?: string | null) {
  if (!value) return ""
  const publishedAt = new Date(value)
  if (Number.isNaN(publishedAt.getTime())) return ""
  const today = new Date()
  const publishedDay = new Date(publishedAt.getFullYear(), publishedAt.getMonth(), publishedAt.getDate())
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffDays = Math.round((todayDay.getTime() - publishedDay.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return "დღეს დაემატა"
  if (diffDays === 1) return "გუშინ დაემატა"
  if (diffDays < 7) return `${diffDays} დღის წინ დაემატა`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} კვირის წინ დაემატა`
  return "დიდხნის წინ დაემატა"
}
