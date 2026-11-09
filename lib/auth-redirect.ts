export function getSafeAuthRedirectPath(input: string | null | undefined, fallback = "/") {
  const safe = String(input ?? "").trim()

  if (!safe) return fallback
  if (!safe.startsWith("/")) return fallback
  if (safe.startsWith("//") || safe.startsWith("/\\")) return fallback
  // URL parsers strip controls and treat backslashes as slashes.
  if (Array.from(safe).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 || char === "\\")) return fallback

  return safe
}

export function getAuthPagePath(
  page: "/login" | "/forgot-password" | "/reset-password",
  nextPath?: string | null,
) {
  const next = getSafeAuthRedirectPath(nextPath)
  return next === "/" ? page : `${page}?${new URLSearchParams({ next })}`
}
