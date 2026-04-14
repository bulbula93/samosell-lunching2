import type { SupabaseClient } from "@supabase/supabase-js"

export const MAX_LISTING_IMAGES = 8
export const MAX_IMAGE_FILE_SIZE_MB = 7
export const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024

export function slugify(value: string) {
  return value
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
  excludeListingId?: string
) {
  const baseSlug = slugify(title) || `listing-${Date.now()}`
  let candidate = baseSlug
  let suffix = 2

  while (true) {
    let query = supabase.from("listings").select("id").eq("slug", candidate).limit(1)
    if (excludeListingId) query = query.neq("id", excludeListingId)
    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) return candidate
    candidate = `${baseSlug}-${suffix}`
    suffix += 1
  }
}

export function validateImageFile(file: File) {
  if (!file.type.startsWith("image/")) return "მხოლოდ სურათის ფაილების ატვირთვაა შესაძლებელი."
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) return `ფაილი ძალიან დიდია. მაქსიმალური ზომაა ${MAX_IMAGE_FILE_SIZE_MB}MB.`
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
  return `${safeAmount} ${currency === "GEL" ? "₾" : currency}`
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
