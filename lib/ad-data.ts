import { unstable_rethrow } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  selectActiveAds,
  type AdPlacementKey,
  type AdRecord,
} from "@/lib/ads"

const AD_SELECT =
  "id, placement_key, title, description, image_url, target_url, is_active, starts_at, ends_at, priority, advertiser_name, created_at"

export async function getActiveAdsForPlacements(placementKeys: readonly AdPlacementKey[]) {
  if (placementKeys.length === 0) return {}

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("ads")
      .select(AD_SELECT)
      .eq("is_active", true)
      .in("placement_key", [...placementKeys])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[ads] active placement lookup failed")
      return {}
    }

    return selectActiveAds((data ?? []) as AdRecord[], placementKeys)
  } catch (error) {
    unstable_rethrow(error)
    console.error("[ads] active placement lookup failed")
    return {}
  }
}
