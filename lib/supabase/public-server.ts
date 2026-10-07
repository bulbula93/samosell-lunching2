import { previewFetchOptions } from "@/lib/preview-read-only"
import "server-only"

import { createClient } from "@supabase/supabase-js"
import { getPublicEnv } from "@/lib/env"

export function createPublicServerClient() {
  const env = getPublicEnv()

  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    ...previewFetchOptions(),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
