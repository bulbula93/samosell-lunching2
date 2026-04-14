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

const publicEnv = {
  supabaseUrl: normalizeUrl(requireNonEmpty("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)),
  supabasePublishableKey: requireNonEmpty(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ),
  siteUrl: normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3000"),
}

export function getPublicEnv() {
  return publicEnv
}

export function getSiteUrlEnv() {
  return publicEnv.siteUrl
}
