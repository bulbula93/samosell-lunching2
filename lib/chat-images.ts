export const CHAT_IMAGE_BUCKET = "chat-images"
export const CHAT_IMAGE_MAX_BYTES = 8 * 1024 * 1024

export const CHAT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export type ChatImageMimeType = (typeof CHAT_IMAGE_MIME_TYPES)[number]

const MIME_EXTENSIONS: Record<ChatImageMimeType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export function isChatImageMimeType(value: unknown): value is ChatImageMimeType {
  return typeof value === "string" && CHAT_IMAGE_MIME_TYPES.includes(value as ChatImageMimeType)
}

export function chatImageExtensionForMime(mimeType: ChatImageMimeType) {
  return MIME_EXTENSIONS[mimeType]
}

export function ownedChatImagePath(path: string, userId: string, chatId: string) {
  const escapedUser = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const escapedChat = chatId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(
    `^${escapedUser}/${escapedChat}/[0-9a-f-]{36}\\.(?:jpg|png|webp)$`,
    "i",
  ).test(path)
}

function detectedMimeType(bytes: Uint8Array): ChatImageMimeType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg"
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp"
  }

  return null
}

export async function validateChatImageBlob(
  blob: Blob,
  expectedMimeType: ChatImageMimeType,
  expectedSize: number,
) {
  if (
    !Number.isSafeInteger(expectedSize) ||
    expectedSize < 1 ||
    expectedSize > CHAT_IMAGE_MAX_BYTES ||
    blob.size !== expectedSize
  ) {
    throw new Error("chat_image_invalid_size")
  }

  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  if (detectedMimeType(header) !== expectedMimeType) {
    throw new Error("chat_image_invalid_type")
  }
}

export function chatImageErrorMessage(code?: string) {
  const safe = String(code ?? "")
  if (safe.includes("chat_image_invalid_size")) {
    return "ფოტო მაქსიმუმ 8 MB უნდა იყოს."
  }
  if (safe.includes("chat_image_invalid_type")) {
    return "დაშვებულია JPG, PNG ან WEBP ფოტო."
  }
  if (safe.includes("conversation_not_found")) {
    return "მიმოწერა ვერ მოიძებნა ან მასზე წვდომა არ გაქვს."
  }
  if (safe.includes("conversation_read_only")) {
    return "ამ მიმოწერაში ახალი შეტყობინების გაგზავნა შეზღუდულია."
  }
  if (safe.includes("conversation_blocked")) {
    return "ამ მომხმარებელთან შეტყობინების გაგზავნა შეზღუდულია."
  }
  if (safe.includes("account_suspended")) {
    return "შეტყობინების გაგზავნა დროებით შეზღუდულია."
  }
  if (safe.includes("message_rate_limited")) {
    return "ძალიან ბევრი შეტყობინება გაიგზავნა. ცოტა ხანში სცადე ხელახლა."
  }
  return "ფოტოს გაგზავნა ვერ მოხერხდა. სცადე ხელახლა."
}
