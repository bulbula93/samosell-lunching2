"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useUnreadNotifications } from "@/lib/use-unread-notifications"
import SignOutButton from "@/components/dashboard/SignOutButton"
import Avatar from "@/components/shared/Avatar"
import MarketplaceSearch from "@/components/layout/MarketplaceSearch"
import MobileBottomNavigation from "@/components/layout/MobileBottomNavigation"
import MobileNavigation, {
  type MarketplaceNavItem,
  type MarketplaceUserState,
} from "@/components/layout/MobileNavigation"
import { ka } from "@/lib/i18n/ka"

function NotificationBell({ count }: { count: number }) {
  return (
    <Link
      href="/dashboard/notifications"
      aria-label={count > 0 ? `ნოტიფიკაციები — ${count} წაუკითხავი` : "ნოტიფიკაციები"}
      title="ნოტიფიკაციები"
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-text transition hover:border-brand/40 hover:bg-brand-soft"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 21h4" />
      </svg>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  )
}

function MarketplaceActionLink({
  kind,
  href,
  prefetch,
}: {
  kind: "sell" | "buy"
  href: string
  prefetch?: boolean
}) {
  const isSell = kind === "sell"

  return (
    <Link
      href={href}
      prefetch={prefetch}
      data-marketplace-action={kind}
      className={`group inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand motion-safe:transition-[transform,box-shadow,background-color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[2px] active:shadow-none sm:gap-2 sm:text-sm ${
        isSell
          ? "border-brand-hover bg-brand text-white shadow-[0_3px_0_#03443e] hover:bg-brand-hover"
          : "border-accent/65 bg-accent-soft text-brand shadow-[0_3px_0_#edc59d] hover:bg-[#ffe9d1]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-brand motion-safe:transition-transform motion-safe:duration-200 ${
          isSell ? "motion-safe:group-hover:-rotate-12" : "motion-safe:group-hover:rotate-12"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          {isSell ? (
            <path d="M9 6a3 3 0 0 1 6 0c0 1.8-3 1.8-3 4M12 10l8.2 5.2a1.2 1.2 0 0 1-.7 2.2h-15a1.2 1.2 0 0 1-.7-2.2L12 10" />
          ) : (
            <>
              <path d="M6 8h12l1 12H5L6 8Z" />
              <path d="M9 9V6a3 3 0 0 1 6 0v3" />
            </>
          )}
        </svg>
      </span>
      <span>{isSell ? "გაყიდე" : "იყიდე"}</span>
    </Link>
  )
}

export default function MarketplaceHeader({
  items,
  userState: initialUserState,
}: {
  items: MarketplaceNavItem[]
  userState: MarketplaceUserState
}) {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const unread = useUnreadNotifications(initialUserState.userId, initialUserState.unreadNotifications, initialUserState.unreadChats)
  const userState = { ...initialUserState, unreadNotifications: unread.notifications, unreadChats: unread.chats }
  const sellHref = userState.signedIn ? "/dashboard/listings/new" : "/sell-fast"
  const isChatRoute = pathname.startsWith("/dashboard/chats")
  const isChatThread = pathname.startsWith("/dashboard/chats/")
  const isListingCreateRoute = pathname === "/dashboard/listings/new"
  const hideMobileMarketplaceSearch = isChatRoute || isListingCreateRoute

  return (
    <>
    <header id="marketplace-header" className={`sticky top-0 z-50 border-b border-line bg-white/95 ${isChatThread ? "hidden md:block" : ""}`}>
      <div className="ui-container flex min-h-[60px] items-center gap-2 py-2 sm:min-h-[72px] sm:gap-3 sm:py-3 lg:gap-5">
        <MobileNavigation items={items} userState={userState} />

        <Link
          href="/"
          aria-label="SAMOSELL-ის მთავარ გვერდზე დაბრუნება"
          className="inline-flex min-h-11 shrink-0 items-center"
        >
          <img
            src="/brand/samosell-header-logo.svg"
            alt="Samo$ell"
            width={164}
            height={50}
            className="h-[34px] w-auto sm:h-[42px]"
          />
        </Link>

        <div className="hidden min-w-0 flex-1 md:block">
          <MarketplaceSearch id="desktop-marketplace-search" />
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
          <MarketplaceActionLink kind="sell" href={sellHref} prefetch={userState.signedIn ? false : undefined} />
          <MarketplaceActionLink kind="buy" href="/catalog" />

          {userState.signedIn ? (
            <>
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
                  <Link prefetch={false} href="/dashboard" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    კაბინეტი
                  </Link>
                  <Link prefetch={false} href="/dashboard/notifications" className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    <span>შეტყობინებები</span>
                    {userState.unreadNotifications > 0 ? (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-white">
                        {userState.unreadNotifications > 99 ? "99+" : userState.unreadNotifications}
                      </span>
                    ) : null}
                  </Link>
                  <Link prefetch={false} href="/dashboard/saved-searches" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    შენახული ძებნები
                  </Link>
                  <Link prefetch={false} href="/dashboard/profile" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    {ka.nav.profile}
                  </Link>
                  <Link prefetch={false} href="/dashboard/listings" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    ჩემი განცხადებები
                  </Link>
                  <Link prefetch={false} href="/dashboard/orders" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    შეკვეთები
                  </Link>
                  <Link prefetch={false} href="/dashboard/billing" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    VIP განთავსება
                  </Link>
                  <Link prefetch={false} href="/dashboard/reports" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
                    რეპორტები
                  </Link>
                  {userState.isAdmin ? (
                    <Link prefetch={false} href="/admin" className="block rounded-xl px-4 py-3 text-sm font-semibold hover:bg-brand-soft">
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

        {userState.signedIn ? <>
          <Link prefetch={false} href="/dashboard/chats" aria-label={unread.chats > 0 ? `ჩათები — ${unread.chats} წაუკითხავი` : "ჩათები"} title="ჩათები" className="relative hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-lg text-text transition hover:border-brand/40 hover:bg-brand-soft md:inline-flex">
            <span aria-hidden="true">✉</span>
            {unread.chats > 0 ? <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-black text-white ring-2 ring-white">{unread.chats > 99 ? "99+" : unread.chats}</span> : null}
          </Link>
          <NotificationBell count={userState.unreadNotifications} />
        </> : null}
        <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex md:ml-0 lg:hidden">
          <MarketplaceActionLink kind="sell" href={sellHref} prefetch={userState.signedIn ? false : undefined} />
          <MarketplaceActionLink kind="buy" href="/catalog" />
        </div>
      </div>

      {!hideMobileMarketplaceSearch ? (
        <div className="border-t border-line px-3 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3 md:hidden">
          <MarketplaceSearch compact id="mobile-header-marketplace-search" />
        </div>
      ) : null}

      <nav aria-label="კატეგორიები" className="hidden border-t border-line bg-bg/90 lg:block">
        <div className="ui-container flex min-h-11 items-center gap-1 overflow-x-auto py-1">
          {items.map((item) => {
            const target = new URL(item.href, "https://samosell.local")
            const pathMatches = pathname === target.pathname
            const queryMatches = Array.from(target.searchParams.entries()).every(
              ([key, value]) => searchParams?.get(key) === value,
            )
            const active = pathMatches && queryMatches && target.searchParams.size > 0
            const isPerfume = item.href === "/catalog?category=perfume"

            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isPerfume
                    ? active
                      ? "bg-[#fff4ec] text-[#b44f17]"
                      : "text-[#b95a20] hover:bg-[#fff4ec] hover:text-[#9b4314]"
                    : active
                      ? "bg-brand-soft text-brand shadow-[inset_0_0_0_1px_rgba(7,63,59,0.06)]"
                      : "text-text-soft hover:bg-brand-soft/70 hover:text-brand"
                }`}
              >
                {isPerfume ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-[#e8894a]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 15c1.2-2.7 2.7-4.7 5-6.1" />
                        <path d="M11.5 5.5c1.8.2 3.6 1.1 5 2.5" />
                        <path d="M15.7 4.7 18 3.5M17.1 8.1l2.7-.1M15.7 11.2l2 1.5" />
                        <path d="M6.2 15.7c-1.7 1.1-2.5 2.2-2.2 3.1.4 1.1 2.6 1.2 5 .2 2.5-1 4-2.5 3.6-3.5-.3-.8-1.6-1-3.2-.7" />
                      </svg>
                    </span>
                    <span>{item.label}</span>
                  </span>
                ) : item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </header>
    <MobileBottomNavigation userState={userState} />
    </>
  )
}
