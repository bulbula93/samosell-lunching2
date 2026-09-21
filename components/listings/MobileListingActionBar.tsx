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
    <div
      className="fixed inset-x-0 z-[65] border-t border-line bg-white/96 px-3 py-2 shadow-[0_-12px_30px_rgba(7,63,59,0.12)] backdrop-blur md:static md:col-span-2 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
      style={{ bottom: "calc(var(--mobile-nav-offset) + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 md:max-w-none">
        <div className="min-w-0 flex-1 md:hidden">
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
            className="ui-btn-primary min-h-11 shrink-0 px-4 md:w-full"
          >
            {ka.listingDetail.edit}
          </Link>
        ) : null}

        {isActive && !isOwner && isAuthenticated && canChat ? (
          <StartChatButton
            listingId={listingId}
            listingSlug={listingSlug}
            presentation="responsive"
            className="ui-btn-primary min-h-11 shrink-0 px-4 md:min-h-12 md:w-full md:shadow-md"
            label={ka.listingDetail.messageSeller}
          />
        ) : null}

        {isActive && !isOwner && !isAuthenticated ? (
          <Link
            href={`/login?next=${encodeURIComponent(listingReturnPath)}`}
            className="ui-btn-primary min-h-11 shrink-0 px-4 text-center md:w-full"
          >
            <span className="md:hidden">მიწერე</span>
            <span className="hidden md:inline">{ka.listingDetail.loginToMessage}</span>
          </Link>
        ) : null}

        {messagingUnavailable ? (
          <button
            type="button"
            disabled
            className="ui-btn-secondary min-h-11 shrink-0 px-4 md:hidden"
            title={ka.listingDetail.messageUnavailable}
          >
            მიუწვდომელია
          </button>
        ) : null}

        {!isActive && !isOwner ? (
          <Link href="/catalog" className="ui-btn-secondary min-h-11 shrink-0 px-4 md:hidden">
            კატალოგი
          </Link>
        ) : null}
      </div>
    </div>
  )
}
