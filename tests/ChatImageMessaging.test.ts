import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  CHAT_IMAGE_BUCKET,
  CHAT_IMAGE_MAX_BYTES,
  chatImageExtensionForMime,
  isChatImageMimeType,
  ownedChatImagePath,
  validateChatImageBlob,
} from "@/lib/chat-images"

const userId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const chatId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"
const imageId = "377f3329-6c04-4c40-8f33-873ab3ee4f76"

describe("chat image messaging", () => {
  it("only accepts the supported image MIME types and stable extensions", () => {
    expect(isChatImageMimeType("image/jpeg")).toBe(true)
    expect(isChatImageMimeType("image/png")).toBe(true)
    expect(isChatImageMimeType("image/webp")).toBe(true)
    expect(isChatImageMimeType("image/gif")).toBe(false)
    expect(chatImageExtensionForMime("image/jpeg")).toBe("jpg")
    expect(chatImageExtensionForMime("image/png")).toBe("png")
    expect(chatImageExtensionForMime("image/webp")).toBe("webp")
    expect(CHAT_IMAGE_BUCKET).toBe("chat-images")
    expect(CHAT_IMAGE_MAX_BYTES).toBe(8 * 1024 * 1024)
  })

  it("binds storage paths to the authenticated user and chat", () => {
    const path = `${userId}/${chatId}/${imageId}.jpg`
    expect(ownedChatImagePath(path, userId, chatId)).toBe(true)
    expect(ownedChatImagePath(`${userId}/${chatId}/${imageId}.gif`, userId, chatId)).toBe(false)
    expect(ownedChatImagePath(`477f3329-6c04-4c40-8f33-873ab3ee4f76/${chatId}/${imageId}.jpg`, userId, chatId)).toBe(false)
  })

  it("checks image signatures instead of trusting the browser MIME type", async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])])
    await expect(validateChatImageBlob(jpeg, "image/jpeg", jpeg.size)).resolves.toBeUndefined()
    await expect(validateChatImageBlob(jpeg, "image/png", jpeg.size)).rejects.toThrow("chat_image_invalid_type")
  })

  it("keeps the bucket private and the image RPC locked to authenticated roles", () => {
    const migrationPath = fileURLToPath(
      new URL("../supabase/migrations/20260916111909_add_private_chat_image_messages.sql", import.meta.url),
    )
    const migration = readFileSync(migrationPath, "utf8")
    expect(migration).toContain("'chat-images'")
    expect(migration).toContain("false,")
    expect(migration).toContain("security definer")
    expect(migration).toContain("revoke all on function public.send_chat_image_message")
    expect(migration).toContain("grant execute on function public.send_chat_image_message")
  })
})
