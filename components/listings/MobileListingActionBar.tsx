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
  isOwner,
  isAuthenticated,
  canChat,
  messagingUnavailable,
  listingReturnPath,
}: MobileListingActionBarProps) {
  return (
    <div
      className={`fixed inset-x-0 z-[65] border-t border-line bg-white/96 px-3 py-2 shadow-[0_-12px_30px_rgba(7,63,59,0.12)] backdrop-blur md:static md:mt-6 md:rounded-[24px] md:border md:border-brand/15 md:bg-[linear-gradient(135deg,#fff8ef,#edf7f1)] md:p-5 md:shadow-[0_12px_32px_rgba(7,63,59,0.07)] md:backdrop-blur-none ${!isOwner && !isActive ? "md:hidden" : ""}`}
      style={{ bottom: "calc(var(--mobile-nav-offset) + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-lg items-center gap-3 md:max-w-none md:flex-col md:items-stretch md:gap-4">
        <div className="hidden md:flex md:items-start md:gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11.4a7.5 7.5 0 0 1-7.5 7.5 9.3 9.3 0 0 1-3.3-.6L4 20l1.7-4.5a7.5 7.5 0 1 1 14.3-4.1Z"/>
              <path d="M9 11h7M9 14h4"/>
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-lg font-black leading-6 text-brand">
              {isOwner ? "შენი განცხადება" : messagingUnavailable ? "მიწერა მიუწვდომელია" : "დაგაინტერესა ეს ნივთი?"}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-text-soft">
              {isOwner ? "საჭიროების შემთხვევაში შეცვალე განცხადების მონაცემები." : messagingUnavailable ? ka.listingDetail.messageUnavailable : !isAuthenticated ? "გამყიდველთან მისაწერად გაიარე ავტორიზაცია." : "მიწერე გამყიდველს და შეუთანხმდი დეტალებზე."}
            </p>
          </div>
        </div>
        <div className="min-w-0 flex-1 md:hidden">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-text-soft">
            ფასი
          </span>
          <strong className="block truncate text-lg font-black leading-tight text-text">
            {listingPriceLabel(price, currency, saleType)}
          </strong>
        </div>

        {isOwner ? (
          <Link
            href={`/dashboard/listings/${listingId}/edit`}
            className="ui-btn-primary min-h-11 shrink-0 px-4 md:min-h-14 md:w-full md:rounded-2xl md:text-base md:font-black"
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
            className="ui-btn-primary min-h-11 shrink-0 gap-2 px-4 md:min-h-14 md:w-full md:rounded-2xl md:text-base md:font-black md:shadow-md"
            icon={<svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a7.5 7.5 0 0 1-7.5 7.5 9 9 0 0 1-3.2-.6L4 20l1.6-4.5A7.5 7.5 0 1 1 20 11Z"/><path d="M9 11h7M9 14h4"/></svg>}
            label={ka.listingDetail.messageSeller}
          />
        ) : null}

        {isActive && !isOwner && !isAuthenticated ? (
          <Link
            href={`/login?next=${encodeURIComponent(listingReturnPath)}`}
            className="ui-btn-primary min-h-11 shrink-0 px-4 text-center md:flex md:min-h-14 md:w-full md:items-center md:justify-center md:rounded-2xl md:text-base md:font-black"
          >
            <span className="md:hidden">მიწერე</span>
            <span className="hidden md:inline">მიწერე გამყიდველს</span>
          </Link>
        ) : null}

        {messagingUnavailable ? (
          <button
            type="button"
            disabled
            className="ui-btn-secondary min-h-11 shrink-0 px-4 opacity-70 md:min-h-14 md:w-full md:rounded-2xl"
            title={ka.listingDetail.messageUnavailable}
          >
            <span className="md:hidden">მიუწვდომელია</span>
            <span className="hidden md:inline">მიწერა მიუწვდომელია</span>
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
