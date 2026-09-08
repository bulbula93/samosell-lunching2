import type { StoryMediaType } from "@/types/story"

export const STORY_CAPTION_MAX_LENGTH = 280
export const STORY_MAX_ACTIVE = 10
export const STORY_IMAGE_MAX_BYTES = 12 * 1024 * 1024
export const STORY_VIDEO_MAX_BYTES = 25 * 1024 * 1024
export const STORY_VIDEO_MAX_DURATION_MS = 15_000
export const STORY_IMAGE_AUTO_ADVANCE_MS = 6_000
export const STORY_RAIL_LIMIT = 24

export const STORY_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const STORY_VIDEO_TYPES = ["video/mp4", "video/webm"] as const

export function isStoryMediaType(value: unknown): value is StoryMediaType {
  return value === "image" || value === "video"
}

export function isStoryMimeType(value: unknown) {
  return typeof value === "string" && (
    STORY_IMAGE_TYPES.includes(value as (typeof STORY_IMAGE_TYPES)[number])
    || STORY_VIDEO_TYPES.includes(value as (typeof STORY_VIDEO_TYPES)[number])
  )
}

export function detectStoryMimeType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp"
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") return "video/mp4"
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm"
  return null
}

export function storyMediaTypeForMime(mimeType: string): StoryMediaType | null {
  if (STORY_IMAGE_TYPES.includes(mimeType as (typeof STORY_IMAGE_TYPES)[number])) return "image"
  if (STORY_VIDEO_TYPES.includes(mimeType as (typeof STORY_VIDEO_TYPES)[number])) return "video"
  return null
}

export function storyExtensionForMime(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg": return "jpg"
    case "image/png": return "png"
    case "image/webp": return "webp"
    case "video/mp4": return "mp4"
    case "video/webm": return "webm"
    default: return null
  }
}

export function formatRelativeStoryTime(value: string) {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "ახლახან"
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return "ახლახან"
  if (minutes < 60) return `${minutes} წთ`
  return `${Math.floor(minutes / 60)} სთ`
}

export function storyErrorMessage(value?: string | null) {
  const message = String(value ?? "").toLowerCase()
  if (message.includes("not_authenticated")) return "Stories-ის გამოსაყენებლად შედი ანგარიშში."
  if (message.includes("active_story_limit_reached")) return "ერთდროულად მაქსიმუმ 10 აქტიური Story შეიძლება გქონდეს."
  if (message.includes("story_rate_limited")) return "ძალიან ბევრი Story გამოქვეყნდა. ცოტა ხანში სცადე ხელახლა."
  if (message.includes("invalid_story_listing")) return "არჩეული განცხადება Story-ს ვეღარ უკავშირდება."
  if (message.includes("story_media_missing")) return "ატვირთული ფაილი ვერ მოიძებნა. თავიდან ატვირთე."
  if (message.includes("story_video_too_long")) return "ვიდეო მაქსიმუმ 15 წამის უნდა იყოს."
  if (message.includes("story_caption_too_long")) return "წარწერა მაქსიმუმ 280 სიმბოლოს უნდა შეიცავდეს."
  if (message.includes("story_unavailable")) return "Story აღარ არის ხელმისაწვდომი."
  if (message.includes("self_story_reply")) return "საკუთარ Story-ს ვერ უპასუხებ."
  if (message.includes("conversation_blocked") || message.includes("interaction_blocked")) return "ამ მომხმარებელთან მოქმედება ხელმისაწვდომი არ არის."
  return "მოქმედება ვერ შესრულდა. სცადე ხელახლა."
}
