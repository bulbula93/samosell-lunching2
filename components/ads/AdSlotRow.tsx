import { Suspense } from "react"
import AdPlacement from "@/components/ads/AdPlacement"
import AdPlaceholder from "@/components/ads/AdPlaceholder"
import { getActiveAdsForPlacements } from "@/lib/ad-data"
import type { AdPlacementKey, AdsByPlacement } from "@/lib/ads"

type AdSlotRowProps = {
  placementKeys: readonly [AdPlacementKey, AdPlacementKey]
  pagePath: string
  className?: string
  contained?: boolean
  ads?: AdsByPlacement
}

function RowLayout({
  placementKeys,
  pagePath,
  ads,
  fallback = false,
}: {
  placementKeys: readonly [AdPlacementKey, AdPlacementKey]
  pagePath: string
  ads: AdsByPlacement
  fallback?: boolean
}) {
  // Two paid catalog placements remain independent. When neither is sold,
  // show one full-width self-service invitation instead of two identical ads.
  const emptyCatalogPair = placementKeys[0] === "catalog_top_left" &&
    placementKeys[1] === "catalog_top_right" &&
    (fallback || placementKeys.every((key) => !ads[key]))
  if (emptyCatalogPair) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <div className="md:col-span-2">
          <AdPlaceholder placementKey="catalog_top_left" />
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
      {placementKeys.map((placementKey) => (
        fallback ? (
          <AdPlaceholder key={placementKey} placementKey={placementKey} />
        ) : (
          <AdPlacement
            key={placementKey}
            placementKey={placementKey}
            ad={ads[placementKey]}
            pagePath={pagePath}
          />
        )
      ))}
    </div>
  )
}

async function LoadedAdSlots({ placementKeys, pagePath }: Pick<AdSlotRowProps, "placementKeys" | "pagePath">) {
  const ads = await getActiveAdsForPlacements(placementKeys)
  return <RowLayout placementKeys={placementKeys} pagePath={pagePath} ads={ads} />
}

export default function AdSlotRow({
  placementKeys,
  pagePath,
  className = "",
  contained = true,
  ads,
}: AdSlotRowProps) {
  const content = ads !== undefined ? (
    <RowLayout placementKeys={placementKeys} pagePath={pagePath} ads={ads} />
  ) : (
    <Suspense fallback={<RowLayout placementKeys={placementKeys} pagePath={pagePath} ads={{}} fallback />}>
      <LoadedAdSlots placementKeys={placementKeys} pagePath={pagePath} />
    </Suspense>
  )

  return (
    <section aria-label="რეკლამა" className={className}>
      {contained ? <div className="ui-container">{content}</div> : content}
    </section>
  )
}
