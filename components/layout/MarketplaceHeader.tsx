import Link from "next/link"
import SignOutButton from "@/components/dashboard/SignOutButton"
import Avatar from "@/components/shared/Avatar"
import MarketplaceSearch from "@/components/layout/MarketplaceSearch"
import MobileNavigation, {
  type MarketplaceNavItem,
  type MarketplaceUserState,
} from "@/components/layout/MobileNavigation"
import { ka } from "@/lib/i18n/ka"

export default function MarketplaceHeader({
  items,
  userState,
}: {
  items: MarketplaceNavItem[]
  userState: MarketplaceUserState
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95">
      <div className="ui-container flex min-h-[72px] items-center gap-3 py-3 lg:gap-5">
        <MobileNavigation items={items} userState={userState} />

        <Link
          href="/"
          aria-label="SAMOSELL-ის მთავარ გვერდზე დაბრუნება"
          className="inline-flex min-h-11 shrink-0 items-center font-logo text-[25px] font-black tracking-[-0.045em] text-brand transition hover:text-brand-hover sm:text-[29px]"
        >
          {ka.brand}
        </Link>

        <Link href="/catalog" className="ui-btn-secondary hidden shrink-0 lg:inline-flex">
          {ka.nav.catalog}
        </Link>

        <div className="hidden min-w-0 flex-1 md:block">
          <MarketplaceSearch id="desktop-marketplace-search" />
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
          <Link href="/catalog" className="ui-btn-primary">
            {ka.home.startShopping}
          </Link>
          <Link href="/dashboard/listings/new" className="ui-btn-secondary">
            {ka.home.startSelling}
          </Link>

          {userState.signedIn ? (
            <>
              <Link
                href="/dashboard/chats"
                aria-label={ka.nav.messages}
                title={ka.nav.messages}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-lg text-text transition hover:border-brand/40 hover:bg-brand-soft"
              >
                ✉
              </Link>
              <Link
                href="/dashboard/favorites"
                aria-label={ka.nav.favorites}
                title={ka.nav.favorites}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-lg text-text transition hover:border-brand/40 hover:bg-brand-soft"
              >
                ♡
              </Link>
              <details className="group relative">
                <summary
                  aria-label={ka.nav.profile}
                  className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-white px-2 pr-3 transition hover:border-brand/40 [&::-webkit-details-marker]:hidden"
                >
                  <Avatar
                    src={userState.profileImage}
                    alt={userState.profileLabel}
                    fallbackText={userState.profileLabel}
                    sizeClassName="h-8 w-8"
                    textClassName="text-[10px]"
                    className="border-0 shadow-none ring-0"
                  />
                  <span className="max-w-28 truncate text-sm font-semibold">{userState.profileLabel}</span>
                  <span aria-hidden="true" className="text-xs text-text-soft transition group-open:rotate-180">⌄</span>
                </summary>
                <nav className="absolute right-0 top-[calc(100%+10px)] w-52 rounded-2xl border border-line bg-white p-2 shadow-[0_18px_50px_rgba(7,63,59,0.14)]">
                  <Link href="/dashboard" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    კაბინეტი
                  </Link>
                  <Link href="/dashboard/profile" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    {ka.nav.profile}
                  </Link>
                  <Link href="/dashboard/listings" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    ჩემი განცხადებები
                  </Link>
                  <Link href="/dashboard/orders" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    შეკვეთები
                  </Link>
                  <Link href="/dashboard/billing" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    VIP განთავსება
                  </Link>
                  <Link href="/dashboard/reports" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    რეპორტები
                  </Link>
                  {userState.isAdmin ? (
                    <Link href="/admin" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                      ადმინისტრირება
                    </Link>
                  ) : null}
                  <div className="mt-1 border-t border-line pt-1">
                    <SignOutButton className="block w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-text transition hover:bg-brand-soft" />
                  </div>
                </nav>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="ui-btn-ghost">
                {ka.nav.login}
              </Link>
              <Link href="/register" className="ui-btn-secondary">
                {ka.nav.register}
              </Link>
            </>
          )}
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex md:ml-0 lg:hidden">
          <Link href="/catalog" className="ui-btn-primary px-3 text-xs sm:px-4 sm:text-sm">
            {ka.home.startShopping}
          </Link>
          <Link href="/dashboard/listings/new" className="ui-btn-secondary px-3 text-xs sm:px-4 sm:text-sm">
            {ka.home.startSelling}
          </Link>
        </div>
      </div>

      <div className="border-t border-line px-4 pb-3 pt-3 md:hidden">
        <MarketplaceSearch compact id="mobile-header-marketplace-search" />
      </div>

      <nav aria-label="კატეგორიები" className="hidden border-t border-line bg-bg/90 lg:block">
        <div className="ui-container flex min-h-11 items-center gap-1 overflow-x-auto py-1">
          {items.map((item) => (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-text-soft transition hover:bg-brand-soft hover:text-brand"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}
