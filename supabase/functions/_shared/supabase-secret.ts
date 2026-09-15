export function readDefaultSupabaseSecretKey(raw: string | null | undefined): string {
  if (!raw) throw new Error("supabase_secret_keys_missing")

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("supabase_secret_keys_invalid")
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("supabase_secret_keys_invalid")
  }

  const secretKey = (parsed as Record<string, unknown>).default
  if (typeof secretKey !== "string" || !secretKey.trim()) {
    throw new Error("supabase_default_secret_key_missing")
  }

  return secretKey.trim()
}
