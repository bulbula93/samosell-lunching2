import Link from "next/link"
import BlockUserForm from "@/components/moderation/BlockUserForm"
import Avatar from "@/components/shared/Avatar"
import StorefrontPanels from "@/components/shared/StorefrontPanels"
import { formatJoinDate, type ListingSellerProfile } from "@/lib/listing-page"
import { sellerTypeLabel } from "@/lib/profiles"
import type { CatalogListing } from "@/types/marketplace"

const sellerStatItems = ({
  sellerActiveListingsCount,
  sellerTotalListingsCount,
  sellerProfile,
  listing,
}: {
  sellerActiveListingsCount: number
  sellerTotalListingsCount: number
  sellerProfile?: ListingSellerProfile | null
  listing: CatalogListing
}) => [
  { label: "აქტიური", value: sellerActiveListingsCount },
  { label: "სულ", value: sellerTotalListingsCount },
  { label: "ჩვენთან არის", value: formatJoinDate(sellerProfile?.created_at || listing.seller_created_at) },
  { label: "სტატუსი", value: sellerProfile?.is_seller_verified ? "დადასტურებული" : "სტანდარტული" },
]

export default function ListingSellerCard({
  sellerProfile,
  listing,
  sellerLabel,
  sellerType,
  sellerAvatarSrc,
  sellerActiveListingsCount,
  sellerTotalListingsCount,
  hasStoreDetails,
  isOwner,
  isBlocked,
}: {
  sellerProfile?: ListingSellerProfile | null
  listing: CatalogListing
  sellerLabel: string
  sellerType: string
  sellerAvatarSrc: string | null
  sellerActiveListingsCount: number
  sellerTotalListingsCount: number
  hasStoreDetails: boolean
  isOwner: boolean
  isBlocked: boolean
}) {
  return (
    <div className="rounded-[1rem] border border-line bg-white p-5 shadow-[0_12px_34px_rgba(23,23,23,0.05)] sm:p-6">
      <div className="flex items-start gap-4">
        {sellerProfile?.username ? (
          <Link href={`/seller/${sellerProfile.username}`} className="shrink-0 transition hover:-translate-y-0.5" aria-label={`${sellerLabel} პროფილის გახსნა`}>
            <Avatar src={sellerAvatarSrc} alt={sellerLabel} fallbackText={sellerLabel} sizeClassName="h-16 w-16" textClassName="text-xl" />
          </Link>
        ) : (
          <Avatar src={sellerAvatarSrc} alt={sellerLabel} fallbackText={sellerLabel} sizeClassName="h-16 w-16" textClassName="text-xl" className="shrink-0" />
        )}
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">{sellerType === "store" ? "მაღაზია" : "გამყიდველი"}</div>
          <h2 className="mt-1 text-2xl font-black">{sellerLabel}</h2>
          <p className="mt-1 text-sm text-neutral-600">{sellerTypeLabel(sellerType)} • {sellerProfile?.city || listing.city || "ქალაქი არ არის მითითებული"}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {sellerStatItems({ sellerActiveListingsCount, sellerTotalListingsCount, sellerProfile, listing }).map((item) => (
          <div key={item.label} className="rounded-[0.9rem] bg-surface-alt px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{item.label}</div>
            <div className="mt-2 text-lg font-black text-neutral-900">{item.value}</div>
          </div>
        ))}
      </div>

      {hasStoreDetails ? (
        <div className="mt-5 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4">
          <StorefrontPanels
            compact
            phone={sellerProfile?.store_phone}
            whatsapp={sellerProfile?.store_whatsapp}
            telegram={sellerProfile?.store_telegram}
            instagram={sellerProfile?.store_instagram}
            facebook={sellerProfile?.store_facebook}
            website={sellerProfile?.store_website}
            hours={sellerProfile?.store_hours}
            address={sellerProfile?.store_address}
            mapUrl={sellerProfile?.store_map_url}
          />
        </div>
      ) : null}

      <p className="mt-5 text-sm leading-7 text-neutral-700">{sellerProfile?.bio || "გამყიდველს პროფილის აღწერა ჯერ არ შეუვსია, თუმცა აქვე შეგიძლია ნახო მისი ყველა აქტიური ნივთი."}</p>

      <div className="mt-5 flex flex-col gap-3">
        {sellerProfile?.username ? (
          <Link href={`/seller/${sellerProfile.username}`} className="ui-btn-secondary w-full text-center">
            ამ გამყიდველის ყველა ნივთი
          </Link>
        ) : null}
        {!isOwner && listing.seller_id ? <BlockUserForm blockedId={listing.seller_id} nextPath={`/listing/${listing.slug}`} isBlocked={isBlocked} /> : null}
      </div>
    </div>
  )
}
