import AdBanner from "@/components/ads/AdBanner"
import AdPlaceholder from "@/components/ads/AdPlaceholder"
import type { AdPlacementKey, AdRecord } from "@/lib/ads"

export default function AdPlacement({
  placementKey,
  ad,
  pagePath,
}: {
  placementKey: AdPlacementKey
  ad?: AdRecord
  pagePath: string
}) {
  return ad ? <AdBanner ad={ad} pagePath={pagePath} /> : <AdPlaceholder placementKey={placementKey} />
}
