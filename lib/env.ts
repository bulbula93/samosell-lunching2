function requireNonEmpty(name: string, value: string | undefined) {
  const safe = String(value ?? "").trim()
  if (!safe) {
    throw new Error(`აკლია გარემოს ცვლადი: ${name}. შეავსე .env.local ფაილი და თავიდან გაუშვი dev server.`)
  }
  return safe
}

function normalizeUrl(value: string) {
  const safe = value.trim().replace(/\/$/, "")
  try {
    return new URL(safe).toString().replace(/\/$/, "")
  } catch {
    throw new Error(`გარემოს ცვლადი URL არასწორია: ${value}`)
  }
}

const QA_PROJECT_REF = "ydocqjdjmffysexkzxyc"
const QA_PUBLISHABLE_KEY = "sb_publishable_GimAu7-NHZn6fbQdl0rTmA_vaDHd4MM"

const supabaseUrl = normalizeUrl(
  requireNonEmpty("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
)

const configuredPublishableKey = requireNonEmpty(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)

const publicEnv = {
  supabaseUrl,
  supabasePublishableKey: supabaseUrl.includes(QA_PROJECT_REF)
    ? QA_PUBLISHABLE_KEY
    : configuredPublishableKey,
  siteUrl: normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000"),
}

export function getPublicEnv() {
  return publicEnv
}

export function getSiteUrlEnv() {
  return publicEnv.siteUrl
}
