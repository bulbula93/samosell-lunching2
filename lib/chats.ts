export const CHAT_MESSAGE_MAX_LENGTH = 2000
export const CHAT_PAGE_SIZE = 24
export const CHAT_MESSAGE_PAGE_SIZE = 50

export const CHAT_INBOX_FILTERS = ["inbox", "archived", "all"] as const
export type ChatInboxFilter = (typeof CHAT_INBOX_FILTERS)[number]

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MESSAGE_ERROR_LABELS: Record<string, string> = {
  not_authenticated: "სესია დასრულებულია. ხელახლა შედი ანგარიშში.",
  message_empty: "შეტყობინება ცარიელი ვერ იქნება.",
  message_too_long: `შეტყობინება მაქსიმუმ ${CHAT_MESSAGE_MAX_LENGTH} სიმბოლოს უნდა შეიცავდეს.`,
  request_id_required: "მოთხოვნის იდენტიფიკატორი არასწორია. განაახლე გვერდი და სცადე თავიდან.",
  request_id_conflict: "შეტყობინების მოთხოვნა ვერ დამუშავდა. სცადე თავიდან.",
  listing_unavailable: "ამ განცხადებაზე ახალი მიმოწერის დაწყება აღარ შეიძლება.",
  self_conversation: "საკუთარ განცხადებაზე საკუთარ თავს ვერ მისწერ.",
  conversation_blocked: "ამ მომხმარებელთან მიმოწერა ხელმისაწვდომი არ არის.",
  conversation_not_found: "მიმოწერა ვერ მოიძებნა ან მასზე წვდომა არ გაქვს.",
  conversation_read_only: "განცხადების მიმდინარე სტატუსზე ახალი შეტყობინების გაგზავნა შეზღუდულია.",
  account_suspended: "შეტყობინების გაგზავნა დროებით შეზღუდულია.",
  message_rate_limited: "ძალიან ბევრი შეტყობინება გაიგზავნა. ცოტა ხანში სცადე ხელახლა.",
}

export function isChatUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value)
}

export function validateChatMessageBody(value: unknown) {
  if (typeof value !== "string") {
    return { ok: false as const, message: "შეტყობინების ტექსტი არასწორია." }
  }

  const body = value.trim()
  if (!body) {
    return { ok: false as const, message: MESSAGE_ERROR_LABELS.message_empty }
  }
  if (body.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { ok: false as const, message: MESSAGE_ERROR_LABELS.message_too_long }
  }

  return { ok: true as const, body }
}

export function chatErrorMessage(value?: string | null) {
  const normalized = String(value ?? "").toLowerCase()
  const matchedCode = Object.keys(MESSAGE_ERROR_LABELS).find((code) =>
    normalized.includes(code),
  )
  return matchedCode
    ? MESSAGE_ERROR_LABELS[matchedCode]
    : "შეტყობინება ვერ გაიგზავნა. ტექსტი შენარჩუნებულია — სცადე ხელახლა."
}

export function parseChatInboxFilter(value: unknown): ChatInboxFilter {
  return CHAT_INBOX_FILTERS.includes(value as ChatInboxFilter)
    ? (value as ChatInboxFilter)
    : "inbox"
}

export function parseChatPage(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : 1
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 1
}

export function canSendChatMessageForStatus(status: string | null | undefined) {
  return status === "active" || status === "reserved" || status === "sold"
}

export function chatCounterpartyName(thread: { counterparty_full_name?: string | null; counterparty_username?: string | null }) {
  return thread.counterparty_full_name || thread.counterparty_username || "მომხმარებელი"
}

export function formatChatTimestamp(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ka-GE", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatBubbleTimestamp(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ka-GE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function truncateChatText(value?: string | null, max = 120) {
  if (!value) return "ჯერ შეტყობინება არ არის"
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
