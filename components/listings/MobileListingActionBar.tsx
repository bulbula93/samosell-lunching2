import Link from "next/link"
import StartChatButton from "@/components/chat/StartChatButton"
import { ka } from "@/lib/i18n/ka"
import { formatPrice } from "@/lib/listings"

type MobileListingActionBarProps = {
  listingId: string
  listingSlug: string
  price: number
  currency: string
  isActive: boolean
  isOwner: boolean
  isAuthenticated: boolean
  canChat: boolean
  messagingUnavailable: boolean
  listingReturnPath: string
}

export default function MobileListingActionBar({
  listingId,
  listingSlug,
  price,
  currency,
  isActive,
  isOwner,
  isAuthenticated,
  canChat,
  messagingUnavailable,
  listingReturnPath,
}: MobileListingActionBarProps) {
  return (
    <aside
      aria-label="ნივთის სწრაფი მოქმედებები"
      className="fixed inset-x-0 z-[65] border-t border-line bg-white/96 px-3 py-2 shadow-[0_-12px_30px_rgba(7,63,59,0.12)] backdrop-blur md:hidden"
      style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-soft">
            ფასი
          </span>
          <strong className="block truncate text-lg font-black leading-tight text-text">
            {formatPrice(price, currency)}
          </strong>
        </div>

        {isOwner ? (
          <Link
            href={`/dashboard/listings/${listingId}/edit`}
            className="ui-btn-primary min-h-11 shrink-0 px-4"
          >
            {ka.listingDetail.edit}
          </Link>
        ) : null}

        {isActive && !isOwner && isAuthenticated && canChat ? (
          <StartChatButton
            listingId={listingId}
            listingSlug={listingSlug}
            presentation="sheet"
            className="ui-btn-primary min-h-11 shrink-0 px-4"
            label={ka.listingDetail.messageSeller}
          />
        ) : null}

        {isActive && !isOwner && !isAuthenticated ? (
          <Link
            href={`/login?next=${encodeURIComponent(listingReturnPath)}`}
            className="ui-btn-primary min-h-11 shrink-0 px-4 text-center"
          >
            მიწერე
          </Link>
        ) : null}

        {messagingUnavailable ? (
          <button
            type="button"
            disabled
            className="ui-btn-secondary min-h-11 shrink-0 px-4"
            title={ka.listingDetail.messageUnavailable}
          >
            მიუწვდომელია
          </button>
        ) : null}

        {!isActive && !isOwner ? (
          <Link href="/catalog" className="ui-btn-secondary min-h-11 shrink-0 px-4">
            კატალოგი
          </Link>
        ) : null}
      </div>
    </aside>
  )
}
