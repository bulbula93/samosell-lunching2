"use server"

import { invalidatePublicMarketplace } from "@/lib/public-marketplace-invalidation"
import { enforceRateLimit } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"

// The browser saves the profile under RLS. This authenticated, rate-limited
// follow-up invalidates its public representations; it accepts no user ID.
export async function refreshPublicProfileAction() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { ok: false }
  // Reuse the existing public-mutation budget; no new database allowlist or migration.
  await enforceRateLimit(supabase, "listing_status_update")
  invalidatePublicMarketplace()
  return { ok: true }
}
