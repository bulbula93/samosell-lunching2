const TIKTOK_USERNAME_PATTERN = /^[a-z0-9._]{2,32}$/i

export function normalizeTikTokUsername(value?: string | null) {
  let normalized = String(value ?? "").trim()
  normalized = normalized.replace(/^https?:\/\/(?:www\.)?tiktok\.com\/@/i, "")
  normalized = normalized.split(/[/?#]/, 1)[0] ?? ""
  normalized = normalized.replace(/^@+/, "").trim()
  return TIKTOK_USERNAME_PATTERN.test(normalized) ? normalized.toLowerCase() : ""
}

export function buildTikTokProfileUrl(value?: string | null) {
  const username = normalizeTikTokUsername(value)
  return username ? `https://www.tiktok.com/@${encodeURIComponent(username)}` : ""
}

export function buildTikTokLiveUrl(value?: string | null) {
  const profileUrl = buildTikTokProfileUrl(value)
  return profileUrl ? `${profileUrl}/live` : ""
}

export function isTikTokLiveActive(liveUntil?: string | null, now = Date.now()) {
  if (!liveUntil) return false
  const expiresAt = new Date(liveUntil).getTime()
  return Number.isFinite(expiresAt) && expiresAt > now
}
