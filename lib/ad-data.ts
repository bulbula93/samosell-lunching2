import { unstable_cache } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { isAdActive, selectActiveAds, type AdPlacementKey, type AdRecord } from "@/lib/ads"

const AD_SELECT = "id, placement_key, title, description, image_url, target_url, is_active, starts_at, ends_at, priority, advertiser_name, created_at"

async function loadActiveAdRows(placementKeys: AdPlacementKey[]): Promise<AdRecord[]> {
  const supabase=createPublicServerClient()
  const {data,error}=await supabase.from("ads").select(AD_SELECT).eq("is_active",true).in("placement_key",[...placementKeys]).order("priority",{ascending:false}).order("created_at",{ascending:false})
  if(error) throw new Error(`active_ads_failed:${error.message}`)
  return (data??[]) as AdRecord[]
}
const getCachedActiveAdRows = unstable_cache(loadActiveAdRows,["active-ad-rows-v2"],{revalidate:60,tags:["active-ads"]})
const getCachedHomeAdRows = unstable_cache(loadActiveAdRows,["home-ad-rows-v1"],{revalidate:300,tags:["active-ads"]})

async function rows(placementKeys:readonly AdPlacementKey[], home = false) {
  const keys=Array.from(new Set(placementKeys)).sort() as AdPlacementKey[]
  return home ? getCachedHomeAdRows(keys) : getCachedActiveAdRows(keys)
}
export async function getActiveAdsForPlacements(placementKeys:readonly AdPlacementKey[]) {
  if(!placementKeys.length)return {}
  try{return selectActiveAds(await rows(placementKeys),placementKeys)}catch(error){unstable_rethrow(error);console.error("[ads] active placement lookup failed");return {}}
}
export async function getActiveAdRotation(placementKeys:readonly AdPlacementKey[], options: { home?: boolean } = {}) {
  if(!placementKeys.length)return []
  try {
    const now = Date.now()
    return (await rows(placementKeys, options.home))
      // Include known future campaigns for the home client's deadline timer;
      // they stay hidden in SSR until starts_at, then activate without polling.
      .filter(ad => isAdActive(ad, new Date(options.home ? Math.max(now, ad.starts_at ? Date.parse(ad.starts_at) : now) : now)))
      .sort((a,b) => a.id.localeCompare(b.id))
  } catch(error) {
    unstable_rethrow(error)
    if (options.home) throw error // preserve the last successful ISR page
    console.error("[ads] active rotation lookup failed")
    return []
  }
}
