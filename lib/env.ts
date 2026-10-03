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

// These values are intentionally public client configuration and already ship in
// the production browser bundle. They are used only as a production safety net
// so a missing Vercel public env cannot take the whole deployment down.
const PRODUCTION_PUBLIC_FALLBACK = {
  supabaseUrl: "https://lxsvjzbiuewgwpajqrwr.supabase.co",
  supabasePublishableKey: "sb_publishable_6XvPvhIJLKZGbsB44LhBkQ_9lKYXUvS",
  siteUrl: "https://samosell.ge",
} as const

function canUseProductionFallback() {
  if (process.env.VERCEL_ENV === "production") return true

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname.toLowerCase()
    return (
      hostname === "samosell.ge" ||
      hostname === "www.samosell.ge" ||
      hostname === "samosell-lunching2-giorgibulbula-6265s-projects.vercel.app"
    )
  }

  return false
}

export function getPublicEnv() {
  const useProductionFallback = canUseProductionFallback()

  const supabaseUrl = normalizeUrl(
    requireNonEmpty(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
        (useProductionFallback ? PRODUCTION_PUBLIC_FALLBACK.supabaseUrl : undefined),
    ),
  )

  const supabasePublishableKey = requireNonEmpty(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      (useProductionFallback ? PRODUCTION_PUBLIC_FALLBACK.supabasePublishableKey : undefined),
  )

  const siteUrl = normalizeUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      (useProductionFallback ? PRODUCTION_PUBLIC_FALLBACK.siteUrl : "http://localhost:3000"),
  )

  return {
    supabaseUrl,
    supabasePublishableKey,
    siteUrl,
  }
}

export function getSiteUrlEnv() {
  return getPublicEnv().siteUrl
}
