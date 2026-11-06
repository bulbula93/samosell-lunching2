import { Suspense } from "react"
import AdPlacement from "@/components/ads/AdPlacement"
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
  // Launch-phase policy: unsold slots render nothing (no "advertise here"
  // filler, no empty band, no placeholder flash while loading). One sold
  // slot spans the full width; two sold slots sit side by side.
  if (fallback) return null
  const sold = placementKeys.filter((placementKey) => Boolean(ads[placementKey]))
  if (sold.length === 0) return null

  return (
    <div className={`grid grid-cols-1 gap-4 md:gap-5 ${sold.length > 1 ? "md:grid-cols-2" : ""}`}>
      {sold.map((placementKey) => (
        <AdPlacement
          key={placementKey}
          placementKey={placementKey}
          ad={ads[placementKey]}
          pagePath={pagePath}
        />
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
    // Drop the section (and its margins) when no slot is sold.
    <section aria-label="რეკლამა" className={`empty:hidden has-[>.ui-container:empty]:hidden ${className}`}>
      {contained ? <div className="ui-container empty:hidden">{content}</div> : content}
    </section>
  )
}
