import Link from "next/link"
import StartChatButton from "@/components/chat/StartChatButton"
import { ka } from "@/lib/i18n/ka"
import { listingPriceLabel } from "@/lib/listings"

type MobileListingActionBarProps = {
  listingId: string
  listingSlug: string
  sellerLabel?: string
  sellerAvatarSrc?: string | null
  listingTitle?: string
  listingImageSrc?: string | null
  price: number
  currency: string
  saleType?: string | null
  isActive: boolean
  availabilityLabel?: string
  isOwner: boolean
  isAuthenticated: boolean
  canChat: boolean
  messagingUnavailable: boolean
  listingReturnPath: string
}

export default function MobileListingActionBar({
  listingId,
  listingSlug,
  sellerLabel,
  sellerAvatarSrc,
  listingTitle,
  listingImageSrc,
  price,
  currency,
  saleType,
  isActive,
  availabilityLabel,
  isOwner,
  isAuthenticated,
  canChat,
  messagingUnavailable,
  listingReturnPath,
}: MobileListingActionBarProps) {
  return (
    <div
      // This page has no bottom navigation. Keep the surface at the viewport edge;
      // Safari's home-indicator inset belongs inside it, never in the bottom offset.
      className="fixed inset-x-0 bottom-0 z-[65] border-t border-line bg-white/96 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-12px_30px_rgba(7,63,59,0.12)] backdrop-blur md:static md:col-span-2 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
    >
      <div className="mx-auto grid max-w-lg grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] items-center gap-3 md:block md:max-w-none">
        <div className="min-w-0 flex-1 md:hidden">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-text-soft">
            {isActive ? "ფასი" : availabilityLabel || "მიუწვდომელია"}
          </span>
          <strong className="block truncate text-lg font-black leading-tight text-text">
            {listingPriceLabel(price, currency, saleType)}
          </strong>
        </div>

        {isOwner ? (
          <Link
            href={`/dashboard/listings/${listingId}/edit`}
            className="ui-btn-primary min-h-12 min-w-0 w-full px-3 text-center md:px-4"
          >
            {ka.listingDetail.edit}
          </Link>
        ) : null}

        {isActive && !isOwner && isAuthenticated && canChat ? (
          <StartChatButton
            listingId={listingId}
            listingSlug={listingSlug}
            sellerLabel={sellerLabel}
            sellerAvatarSrc={sellerAvatarSrc}
            listingTitle={listingTitle}
            listingImageSrc={listingImageSrc}
            priceLabel={listingPriceLabel(price, currency, saleType)}
            presentation="responsive"
            className="ui-btn-primary min-h-12 min-w-0 w-full px-3 text-center md:px-4 md:shadow-md"
            label={ka.listingDetail.messageSeller}
          />
        ) : null}

        {isActive && !isOwner && !isAuthenticated ? (
          <Link
            href={`/login?next=${encodeURIComponent(listingReturnPath)}`}
            aria-label={ka.listingDetail.loginToMessage}
            className="ui-btn-primary min-h-12 min-w-0 w-full px-3 text-center md:px-4"
          >
            <span className="flex flex-col items-center gap-0.5 md:hidden">
              <span>მიწერე გამყიდველს</span>
              <span className="text-[11px] font-normal">საჭიროა შესვლა</span>
            </span>
            <span className="hidden md:inline">{ka.listingDetail.loginToMessage}</span>
          </Link>
        ) : null}

        {messagingUnavailable ? (
          <button
            type="button"
            disabled
            className="ui-btn-secondary min-h-12 min-w-0 w-full px-3 text-center"
            title={ka.listingDetail.messageUnavailable}
          >
            მიუწვდომელია
          </button>
        ) : null}

        {!isActive && !isOwner ? (
          <Link href="/catalog" className="ui-btn-secondary min-h-12 min-w-0 w-full px-3 text-center">
            სხვა ნივთების ნახვა
          </Link>
        ) : null}
      </div>
    </div>
  )
}
