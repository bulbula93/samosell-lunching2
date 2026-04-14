export function chatCounterpartyName(thread: { counterparty_full_name?: string | null; counterparty_username?: string | null }) {
  return thread.counterparty_full_name || thread.counterparty_username || "მომხმარებელი"
}

export function formatChatTimestamp(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
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
