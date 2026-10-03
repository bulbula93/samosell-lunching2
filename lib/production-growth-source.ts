import "server-only"

import { createClient } from "@supabase/supabase-js"

const PRODUCTION_SUPABASE_URL = "https://lxsvjzbiuewgwpajqrwr.supabase.co"
const PRODUCTION_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_6XvPvhIJLKZGbsB44LhBkQ_9lKYXUvS"

export type ProductionGrowthPayload = {
  generatedAt?: string
  activeListings?: number | string
  listings24h?: number | string
  listings7d?: number | string
  newProfiles24h?: number | string
  newProfiles7d?: number | string
  chats7d?: number | string
  sold7d?: number | string
  sellersWithActiveListings?: number | string
  activatedSellers?: number | string
  warmSellers?: number | string
  singleListingSellers?: number | string
}

export async function fetchProductionGrowthSnapshot() {
  const supabase = createClient(
    PRODUCTION_SUPABASE_URL,
    PRODUCTION_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )

  const { data, error } = await supabase.rpc("marketing_growth_snapshot")

  return {
    data: (data ?? {}) as ProductionGrowthPayload,
    error,
  }
}
