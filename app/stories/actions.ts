"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { enforceRateLimit } from "@/lib/rate-limit"
import { isChatUuid, validateChatMessageBody } from "@/lib/chats"
import { notifyChatMessage } from "@/lib/notifications"
import {
  detectStoryMimeType,
  isStoryMimeType,
  STORY_CAPTION_MAX_LENGTH,
  STORY_IMAGE_MAX_BYTES,
  STORY_VIDEO_MAX_BYTES,
  storyErrorMessage,
  storyExtensionForMime,
  storyMediaTypeForMime,
} from "@/lib/stories"

const STORY_BUCKET = "story-media"

async function authenticatedContext() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : { supabase, user }
}

function ownedStoryPath(path: string, userId: string, storyId: string) {
  const escapedUser = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const escapedStory = storyId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`^${escapedUser}/${escapedStory}/[0-9a-f-]{36}\\.(?:jpg|png|webp|mp4|webm)$`, "i").test(path)
}

export type PrepareStoryUploadInput = { mimeType: string; size: number }
export type PrepareStoryUploadResult =
  | { ok: true; storyId: string; path: string; token: string }
  | { ok: false; message: string }

export async function prepareStoryUploadAction(input: PrepareStoryUploadInput): Promise<PrepareStoryUploadResult> {
  const context = await authenticatedContext()
  if (!context) return { ok: false, message: "Story-ის დასამატებლად შედი ანგარიშში." }
  const mimeType = String(input?.mimeType ?? "")
  const size = Number(input?.size ?? 0)
  const mediaType = storyMediaTypeForMime(mimeType)
  const maxBytes = mediaType === "video" ? STORY_VIDEO_MAX_BYTES : STORY_IMAGE_MAX_BYTES
  const extension = storyExtensionForMime(mimeType)
  if (!isStoryMimeType(mimeType) || !mediaType || !extension || !Number.isSafeInteger(size) || size < 1 || size > maxBytes) {
    return { ok: false, message: mediaType === "video" ? "ვიდეო მაქსიმუმ 25 MB უნდა იყოს." : "ფოტო მაქსიმუმ 12 MB უნდა იყოს." }
  }
  try {
    await enforceRateLimit(context.supabase, "story_upload")
    const storyId = crypto.randomUUID()
    const path = `${context.user.id}/${storyId}/${crypto.randomUUID()}.${extension}`
    const { data, error } = await context.supabase.storage.from(STORY_BUCKET).createSignedUploadUrl(path)
    if (error || !data?.token) throw error ?? new Error("signed_upload_missing")
    return { ok: true, storyId, path, token: data.token }
  } catch (error) {
    return { ok: false, message: storyErrorMessage(error instanceof Error ? error.message : "") }
  }
}

export async function abortStoryUploadAction(storyId: string, path: string) {
  const context = await authenticatedContext()
  if (!context || !isChatUuid(storyId) || !ownedStoryPath(path, context.user.id, storyId)) return
  await context.supabase.storage.from(STORY_BUCKET).remove([path])
}

export type PublishStoryInput = {
  storyId: string
  path: string
  mediaType: "image" | "video"
  caption?: string
  linkedListingId?: string
  mediaWidth?: number | null
  mediaHeight?: number | null
  durationMs?: number | null
}

export async function publishStoryAction(input: PublishStoryInput) {
  const context = await authenticatedContext()
  if (!context) return { ok: false as const, message: "Story-ის გამოსაქვეყნებლად შედი ანგარიშში." }
  const caption = String(input?.caption ?? "").trim()
  if (!isChatUuid(input?.storyId) || !ownedStoryPath(String(input?.path ?? ""), context.user.id, input.storyId)) {
    return { ok: false as const, message: "Story ფაილის მისამართი არასწორია." }
  }
  if (caption.length > STORY_CAPTION_MAX_LENGTH) return { ok: false as const, message: "წარწერა მაქსიმუმ 280 სიმბოლოს უნდა შეიცავდეს." }
  if (input.linkedListingId && !isChatUuid(input.linkedListingId)) return { ok: false as const, message: "არჩეული განცხადება არასწორია." }

  try {
    const { data: blob, error: downloadError } = await context.supabase.storage.from(STORY_BUCKET).download(input.path)
    if (downloadError || !blob) throw new Error("story_media_missing")
    const maxBytes = input.mediaType === "video" ? STORY_VIDEO_MAX_BYTES : STORY_IMAGE_MAX_BYTES
    if (blob.size < 1 || blob.size > maxBytes) throw new Error("invalid_story_media_size")
    const detectedMime = detectStoryMimeType(new Uint8Array(await blob.arrayBuffer()))
    if (storyMediaTypeForMime(detectedMime ?? "") !== input.mediaType) throw new Error("invalid_story_media_type")

    const { data, error } = await context.supabase.rpc("create_story", {
      p_story_id: input.storyId,
      p_media_path: input.path,
      p_media_type: input.mediaType,
      p_caption: caption || null,
      p_linked_listing_id: input.linkedListingId || null,
      p_media_width: input.mediaWidth ?? null,
      p_media_height: input.mediaHeight ?? null,
      p_duration_ms: input.mediaType === "video" ? input.durationMs ?? null : null,
    })
    if (error || !data) throw error ?? new Error("story_create_failed")
    revalidatePath("/")
    if (context.user.user_metadata?.username) revalidatePath(`/seller/${context.user.user_metadata.username}`)
    return { ok: true as const, storyId: String(data) }
  } catch (error) {
    await context.supabase.storage.from(STORY_BUCKET).remove([input.path])
    return { ok: false as const, message: storyErrorMessage(error instanceof Error ? error.message : "") }
  }
}

export async function setFollowAction(followingId: string, followed: boolean) {
  const context = await authenticatedContext()
  if (!context) return { ok: false as const, message: "გამოწერისთვის შედი ანგარიშში." }
  if (!isChatUuid(followingId)) return { ok: false as const, message: "მომხმარებელი ვერ მოიძებნა." }
  const { data, error } = await context.supabase.rpc("set_user_followed", { p_following_id: followingId, p_followed: followed })
  if (error) return { ok: false as const, message: storyErrorMessage(error.message) }
  revalidatePath("/")
  return { ok: true as const, followed: Boolean(data) }
}

export async function deleteStoryAction(storyId: string) {
  const context = await authenticatedContext()
  if (!context || !isChatUuid(storyId)) return { ok: false as const, message: "Story ვერ მოიძებნა." }
  const { data, error } = await context.supabase.rpc("delete_own_story", { p_story_id: storyId })
  if (error || !data) return { ok: false as const, message: storyErrorMessage(error?.message) }
  revalidatePath("/")
  return { ok: true as const }
}

export async function setStoryMuteAction(userId: string, muted: boolean) {
  const context = await authenticatedContext()
  if (!context) return { ok: false as const, message: "Story-ის დასამალად შედი ანგარიშში." }
  if (!isChatUuid(userId)) return { ok: false as const, message: "მომხმარებელი ვერ მოიძებნა." }
  const { error } = await context.supabase.rpc("set_story_muted", { p_muted_user_id: userId, p_muted: muted })
  if (error) return { ok: false as const, message: storyErrorMessage(error.message) }
  revalidatePath("/")
  return { ok: true as const }
}

export async function recordStoryViewAction(storyId: string) {
  const context = await authenticatedContext()
  if (!context || !isChatUuid(storyId)) return false
  const { data } = await context.supabase.rpc("record_story_view", { p_story_id: storyId })
  return Boolean(data)
}

export async function recordStoryListingClickAction(storyId: string) {
  if (!isChatUuid(storyId)) return false
  const supabase = await createClient()
  const { data } = await supabase.rpc("record_story_listing_click", { p_story_id: storyId })
  return Boolean(data)
}

export async function replyToStoryAction(input: { storyId: string; body: string; clientRequestId: string }) {
  const context = await authenticatedContext()
  if (!context) return { ok: false as const, message: "პასუხისთვის შედი ანგარიშში." }
  const validation = validateChatMessageBody(input?.body)
  if (!isChatUuid(input?.storyId) || !isChatUuid(input?.clientRequestId) || !validation.ok) {
    return { ok: false as const, message: validation.ok ? "მოთხოვნა არასწორია." : validation.message }
  }
  const { data, error } = await context.supabase.rpc("reply_to_story", {
    p_story_id: input.storyId,
    p_body: validation.body,
    p_client_request_id: input.clientRequestId,
  })
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) return { ok: false as const, message: storyErrorMessage(error?.message) }
  await notifyChatMessage({
    chatId: row.chat_id,
    messageId: row.message_id,
    senderId: context.user.id,
    body: row.message_body,
    firstMessage: false,
  })
  return { ok: true as const, chatId: row.chat_id }
}

export async function reportStoryAction(input: { storyId: string; reason: string; details?: string }) {
  const context = await authenticatedContext()
  if (!context) return { ok: false as const, message: "რეპორტისთვის შედი ანგარიშში." }
  if (!isChatUuid(input?.storyId)) return { ok: false as const, message: "Story ვერ მოიძებნა." }
  const details = String(input.details ?? "").trim()
  if (details.length > 2000) return { ok: false as const, message: "დეტალები მაქსიმუმ 2000 სიმბოლოს უნდა შეიცავდეს." }
  const { error } = await context.supabase.rpc("submit_story_report", { p_story_id: input.storyId, p_reason: input.reason, p_details: details })
  return error ? { ok: false as const, message: storyErrorMessage(error.message) } : { ok: true as const }
}

export async function blockStoryOwnerAction(userId: string) {
  const context = await authenticatedContext()
  if (!context || !isChatUuid(userId)) return { ok: false as const, message: "მომხმარებელი ვერ მოიძებნა." }
  const { error } = await context.supabase.rpc("set_user_blocked", { p_blocked_id: userId, p_blocked: true })
  if (error) return { ok: false as const, message: storyErrorMessage(error.message) }
  revalidatePath("/")
  return { ok: true as const }
}
