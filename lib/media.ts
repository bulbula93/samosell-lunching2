export const PUBLIC_STORAGE_HOST = "lxsvjzbiuewgwpajqrwr.supabase.co"
export const PUBLIC_STORAGE_PATH_PREFIX = "/storage/v1/object/public/"

export function getSafeImageSource(value?: string | null) {
  const source = String(value ?? "").trim()
  if (!source) return null
  if (source.startsWith("/") && !source.startsWith("//")) return source

  try {
    const url = new URL(source)
    const allowed =
      url.protocol === "https:" &&
      url.hostname === PUBLIC_STORAGE_HOST &&
      url.pathname.startsWith(PUBLIC_STORAGE_PATH_PREFIX)

    return allowed ? url.toString() : null
  } catch {
    return null
  }
}
