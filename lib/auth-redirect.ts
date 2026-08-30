export function getSafeAuthRedirectPath(input: string | null | undefined, fallback = "/") {
  const safe = String(input ?? "").trim()

  if (!safe) return fallback
  if (!safe.startsWith("/")) return fallback
  if (safe.startsWith("//") || safe.startsWith("/\\")) return fallback

  return safe
}
