import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { getPublicEnv } from "@/lib/env"

function requireServiceRoleKey() {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()
  if (!key) {
    throw new Error("აკლია გარემოს ცვლადი: SUPABASE_SERVICE_ROLE_KEY")
  }
  return key
}

export function createAdminClient() {
  const env = getPublicEnv()
  return createSupabaseClient(env.supabaseUrl, requireServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
