export const PUBLIC_STORAGE_HOST = "lxsvjzbiuewgwpajqrwr.supabase.co"
export const PUBLIC_STORAGE_PATH_PREFIX = "/storage/v1/object/public/"

export function getPublicStorageHosts(supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const hosts = new Set([PUBLIC_STORAGE_HOST])
  try {
    const configured = new URL(supabaseUrl ?? "")
    if (configured.protocol === "https:" && !configured.port && !configured.username && !configured.password && /^[a-z0-9]{20}\.supabase\.co$/.test(configured.hostname)) {
      hosts.add(configured.hostname)
    }
  } catch { /* Missing or invalid configuration must not allow another host. */ }
  return [...hosts]
}

export function getSafeImageSource(value?: string | null) {
  const source = String(value ?? "").trim()
  if (!source) return null
  if (source.startsWith("/") && !source.startsWith("//")) return source

  try {
    const url = new URL(source)
    const allowed =
      url.protocol === "https:" &&
      !url.port && !url.username && !url.password &&
      getPublicStorageHosts().includes(url.hostname) &&
      url.pathname.startsWith(PUBLIC_STORAGE_PATH_PREFIX)

    return allowed ? url.toString() : null
  } catch {
    return null
  }
}
