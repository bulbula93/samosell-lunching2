import Link from "next/link"
import StartChatButton from "@/components/chat/StartChatButton"
import FavoriteToggleForm from "@/components/favorites/FavoriteToggleForm"
import Avatar from "@/components/shared/Avatar"
import { conditionLabel, formatPrice, genderLabel } from "@/lib/listings"
import type { ListingSellerProfile } from "@/lib/listing-page"
import type { CatalogListing } from "@/types/marketplace"

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <path d="M6.7 3.5h3.1l1.1 4.4-2 1.7a14 14 0 0 0 5.2 5.2l1.7-2 4.4 1.1v3.1a1.8 1.8 0 0 1-1.9 1.8A15.8 15.8 0 0 1 3.5 5.4 1.8 1.8 0 0 1 5.3 3.5h1.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4.5 3v-3H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarRow() {
  return (
    <div className="flex items-center gap-1 text-[#F88A51]">
      {Array.from({ length: 4 }).map((_, index) => (
        <svg key={index} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M12 2.9 14.8 8.6l6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20l1-6.1-4.4-4.4 6.1-.9L12 2.9Z" />
        </svg>
      ))}
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 text-[#F88A51]">
        <path d="M12 2.9 14.8 8.6l6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20l1-6.1-4.4-4.4 6.1-.9L12 2.9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function DetailChip({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2 text-[16px] font-normal leading-4 text-[#5F6368]">{label}</div>
      <div className="inline-flex min-h-8 items-center justify-center rounded-[4px] border border-[#2D2D2D] bg-[#2D2D2D] px-4 text-[16px] font-medium leading-8 text-[#E7E7E7]">
        {value}
      </div>
    </div>
  )
}

function sanitizePhone(phone?: string | null) {
  if (!phone) return null
  const trimmed = phone.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default function ListingOverviewCard({
  listing,
  sellerProfile,
  sellerLabel,
  sellerAvatarSrc,
  sellerActiveListingsCount,
  isOwner,
  isAuthenticated,
  canChat,
  isFavorited,
  chatError,
  reportFlash,
  isBlocked,
  isBlockedBySeller,
  sellerSuspended,
}: {
  listing: CatalogListing
  sellerProfile?: ListingSellerProfile | null
  sellerLabel: string
  sellerAvatarSrc: string | null
  sellerActiveListingsCount: number
  isOwner: boolean
  isAuthenticated: boolean
  canChat: boolean
  isFavorited: boolean
  chatError: string
  reportFlash: string
  isBlocked: boolean
  isBlockedBySeller: boolean
  sellerSuspended: boolean
}) {
  const phone = sanitizePhone(sellerProfile?.store_phone) || "+995 555 444 333"
  const sellerProfileHref = sellerProfile?.username ? `/seller/${sellerProfile.username}` : null
  const sellerItemsLabel = `${sellerActiveListingsCount} ნივთი`
  const description = listing.description?.trim() || "აქ კლიენტი დაწერს რამე დამატებით ინფორმაციას, მაგალითად რა ფერია, რა მატერიაა, და რატომ ყიდის ამ ნივთს."
  const sectionValue = genderLabel(listing.gender)
  const categoryValue = listing.category_name || "ფეხსაცმელი"
  const sizeValue = listing.size_label || "44"
  const conditionValue = conditionLabel(listing.condition)
  const cityValue = listing.city || "თბილისი"

  return (
    <div className="w-full max-w-[616px] space-y-4 text-[#2D2D2D]">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-medium uppercase leading-8 text-[#2D2D2D]">{listing.title}</h1>
        </div>
        <FavoriteToggleForm
          listingId={listing.id}
          listingSlug={listing.slug}
          nextPath={`/listing/${listing.slug}`}
          isFavorited={isFavorited}
          compact
          className="h-8 w-8 rounded-full border-0 bg-[#212831] hover:bg-[#171d24]"
        />
      </div>

      <div className="text-[24px] font-bold leading-8 text-[#2D2D2D]">{formatPrice(listing.price, listing.currency)}</div>

      <div className="flex flex-wrap items-start gap-x-4 gap-y-4">
        <DetailChip label="კატეგორია" value={sectionValue} className="w-[112px]" />
        <DetailChip label="ქვეკატეგორია" value={categoryValue} className="w-[134px]" />
        <DetailChip label="ზომა" value={sizeValue} className="w-[69px]" />
        <DetailChip label="კონდიცია" value={conditionValue} className="w-[84px]" />
        <DetailChip label="ლოკაცია" value={cityValue} className="min-w-[92px] flex-1" />
      </div>

      <div className="rounded-[8px] bg-[#F3F3F3] p-4 text-[16px] leading-6 text-[#2D2D2D]/75">
        {description}
      </div>

      <div className="border-b border-[#2E3134]/30 pb-4">
        <div className="flex items-start gap-3">
          {sellerProfileHref ? (
            <Link href={sellerProfileHref} className="shrink-0">
              <Avatar src={sellerAvatarSrc} alt={sellerLabel} fallbackText={sellerLabel} sizeClassName="h-12 w-12" textClassName="text-sm" className="border-0 shadow-none ring-0" />
            </Link>
          ) : (
            <Avatar src={sellerAvatarSrc} alt={sellerLabel} fallbackText={sellerLabel} sizeClassName="h-12 w-12" textClassName="text-sm" className="border-0 shadow-none ring-0" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="truncate text-[16px] font-medium leading-6 text-[#2D2D2D]">{sellerLabel}</div>
              {sellerProfileHref ? (
                <Link href={sellerProfileHref} className="text-[16px] font-bold leading-5 text-[#F88A51] underline underline-offset-2">
                  {sellerItemsLabel}
                </Link>
              ) : (
                <span className="text-[16px] font-bold leading-5 text-[#F88A51] underline underline-offset-2">{sellerItemsLabel}</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[16px] leading-5 text-[#2D2D2D]">
              <StarRow />
              <span>(4.3)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[#C2C3C4] pb-4">
        <div className="mb-4 text-[16px] font-semibold leading-4 text-[#2D2D2D]">საკონტაქტო ინფორმაცია</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            className="inline-flex min-h-[60px] items-center justify-center gap-4 rounded-[16px] border border-black bg-white px-4 text-[20px] font-medium leading-7 text-[#2D2D2D]"
          >
            <PhoneIcon />
            <span className="truncate">{phone}</span>
          </a>

          {isOwner ? (
            <Link href={`/dashboard/listings/${listing.id}/edit`} className="inline-flex min-h-[60px] items-center justify-center gap-4 rounded-[16px] bg-[#F88A51] px-4 text-[20px] font-medium leading-6 text-white transition hover:bg-[#ef7d46]">
              <ChatIcon />
              <span>რედაქტირება</span>
            </Link>
          ) : isAuthenticated ? (
            canChat ? (
              <div className="[&_button]:inline-flex [&_button]:min-h-[60px] [&_button]:w-full [&_button]:items-center [&_button]:justify-center [&_button]:gap-4 [&_button]:rounded-[16px] [&_button]:bg-[#F88A51] [&_button]:px-4 [&_button]:text-[20px] [&_button]:font-medium [&_button]:leading-6 [&_button]:text-white [&_button]:transition hover:[&_button]:bg-[#ef7d46]">
                <StartChatButton listingId={listing.id} listingSlug={listing.slug} label="ონლაინ ჩატი" icon={<ChatIcon />} />
              </div>
            ) : (
              <button type="button" disabled className="inline-flex min-h-[60px] items-center justify-center gap-4 rounded-[16px] bg-[#D9D9D9] px-4 text-[20px] font-medium leading-6 text-white">
                <ChatIcon />
                <span>ონლაინ ჩატი</span>
              </button>
            )
          ) : (
            <Link href={`/login?next=${encodeURIComponent(`/listing/${listing.slug}`)}`} className="inline-flex min-h-[60px] items-center justify-center gap-4 rounded-[16px] bg-[#F88A51] px-4 text-[20px] font-medium leading-6 text-white transition hover:bg-[#ef7d46]">
              <ChatIcon />
              <span>ონლაინ ჩატი</span>
            </Link>
          )}
        </div>
      </div>

      {chatError ? <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{chatError}</div> : null}
      {reportFlash ? <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{reportFlash}</div> : null}
      {!isOwner && isBlocked ? <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ეს მომხმარებელი დაბლოკილი გაქვს.</div> : null}
      {!isOwner && isBlockedBySeller ? <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ამ მომხმარებელმა შენთვის შეტყობინებები შეზღუდა.</div> : null}
      {!isOwner && sellerSuspended ? <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">გამყიდველის ანგარიში დროებით შეზღუდულია.</div> : null}
    </div>
  )
}
