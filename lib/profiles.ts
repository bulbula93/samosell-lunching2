export type SellerType = "individual" | "store"

export function sellerTypeLabel(value?: string | null) {
  switch (value) {
    case "store":
      return "მაღაზია"
    case "individual":
    default:
      return "ფიზიკური პირი"
  }
}

export function getInitials(value?: string | null) {
  return String(value || "SS")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SS"
}

type SellerVisualProfile = {
  seller_type?: string | null
  avatar_url?: string | null
  store_logo_url?: string | null
}

export function getSellerVisualAvatar(profile?: SellerVisualProfile | null) {
  if (!profile) return null
  if (profile.seller_type === "store") return profile.store_logo_url || profile.avatar_url || null
  return profile.avatar_url || null
}

export function getUserAvatar(profile?: SellerVisualProfile | null) {
  if (!profile) return null
  return profile.avatar_url || profile.store_logo_url || null
}

export function normalizePhoneNumber(value?: string | null) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  return raw.replace(/[^\d+\s()-]/g, "").trim()
}

export function toTelHref(value?: string | null) {
  const normalized = normalizePhoneNumber(value)
  if (!normalized) return ""
  const compact = normalized.replace(/[^\d+]/g, "")
  return compact ? `tel:${compact}` : ""
}

export function normalizeInstagramHandle(value?: string | null) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw)
      const first = url.pathname.split("/").filter(Boolean)[0] ?? ""
      return first.replace(/^@/, "")
    } catch {
      return raw.replace(/^@/, "")
    }
  }
  return raw.replace(/^@/, "")
}

export function toInstagramUrl(value?: string | null) {
  const handle = normalizeInstagramHandle(value)
  return handle ? `https://instagram.com/${handle}` : ""
}

export function normalizeUrl(value?: string | null) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

export function buildMapUrl(address?: string | null, explicitMapUrl?: string | null) {
  const direct = normalizeUrl(explicitMapUrl)
  if (direct) return direct
  const normalizedAddress = String(address ?? "").trim()
  if (!normalizedAddress) return ""
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedAddress)}`
}

export function buildMapEmbedUrl(address?: string | null, explicitMapUrl?: string | null) {
  const normalizedAddress = String(address ?? "").trim()
  if (normalizedAddress) {
    return `https://www.google.com/maps?q=${encodeURIComponent(normalizedAddress)}&output=embed`
  }
  const direct = normalizeUrl(explicitMapUrl)
  if (!direct) return ""

  try {
    const url = new URL(direct)
    const query =
      url.searchParams.get("q") ||
      url.searchParams.get("query") ||
      url.searchParams.get("destination") ||
      url.searchParams.get("daddr") ||
      ""
    if (query) {
      return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
    }
  } catch {
    return ""
  }

  return ""
}

export function toWhatsAppUrl(value?: string | null) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  if (/^https?:\/\//i.test(raw)) return raw
  const compact = raw.replace(/[^\d]/g, "")
  return compact ? `https://wa.me/${compact}` : ""
}

export function normalizeTelegramHandle(value?: string | null) {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw)
      const first = url.pathname.split("/").filter(Boolean)[0] ?? ""
      return first.replace(/^@/, "")
    } catch {
      return raw.replace(/^@/, "")
    }
  }
  return raw.replace(/^@/, "")
}

export function toTelegramUrl(value?: string | null) {
  const handle = normalizeTelegramHandle(value)
  return handle ? `https://t.me/${handle}` : ""
}

export function parseWeeklyHours(value?: string | null) {
  const raw = String(value ?? "").trim()
  if (!raw) return [] as Array<{ label: string; value: string }>

  const lines = raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line) => {
    const match = line.match(/^([^:-]+)\s*[:\-–—]\s*(.+)$/)
    if (match) {
      return { label: match[1].trim(), value: match[2].trim() }
    }
    return { label: "სამუშაო საათები", value: line }
  })
}
