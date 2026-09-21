"use client"

import Link from "next/link"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import type { MarketplaceUserState } from "@/components/layout/MobileNavigation"

type NavKey = "home" | "catalog" | "sell" | "messages" | "profile"

function Icon({ name }: { name: NavKey }) {
  const common = "h-5 w-5"
  if (name === "home") {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" /></svg>
  }
  if (name === "catalog") {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4V5Zm10 0h6v6h-6V5ZM4 15h6v4H4v-4Zm10 0h6v4h-6v-4Z" /></svg>
  }
  if (name === "sell") {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
  }
  if (name === "messages") {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 9a7 7 0 0 0-14 0" /></svg>
}

export default function MobileBottomNavigation({ userState }: { userState: MarketplaceUserState }) {
  const pathname = usePathname() ?? ""
  const hideForChatThread = pathname.startsWith("/dashboard/chats/")
  const sellHref = userState.signedIn ? "/dashboard/listings/new" : "/sell-fast"
  const messagesHref = userState.signedIn ? "/dashboard/chats" : "/login"
  const profileHref = userState.signedIn ? "/dashboard/profile" : "/login"
  const unreadChats = userState.unreadChats ?? 0

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return

    const previousPaddingBottom = document.body.style.paddingBottom
    const media = window.matchMedia("(max-width: 767px)")

    const syncBodyPadding = () => {
      document.body.style.paddingBottom =
        media.matches && !hideForChatThread
          ? "calc(4.75rem + env(safe-area-inset-bottom))"
          : previousPaddingBottom
    }

    syncBodyPadding()
    media.addEventListener("change", syncBodyPadding)
    return () => {
      media.removeEventListener("change", syncBodyPadding)
      document.body.style.paddingBottom = previousPaddingBottom
    }
  }, [hideForChatThread])

  if (hideForChatThread) return null

  const active = (key: NavKey) => {
    if (key === "home") return pathname === "/"
    if (key === "catalog") return pathname.startsWith("/catalog")
    if (key === "sell") return pathname === "/sell-fast" || pathname.startsWith("/dashboard/listings/new")
    if (key === "messages") return pathname.startsWith("/dashboard/chats")
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/profile")
  }

  const itemClass = (key: NavKey) =>
    `relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold transition ${active(key) ? "text-brand" : "text-text-soft"}`

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="მობილური სწრაფი ნავიგაცია"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-white/95 px-2 pt-1 shadow-[0_-10px_30px_rgba(7,63,59,0.09)] backdrop-blur md:hidden"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
        <Link href="/" aria-current={active("home") ? "page" : undefined} className={itemClass("home")}>
          <Icon name="home" />
          <span>მთავარი</span>
        </Link>

        <Link href="/catalog" aria-current={active("catalog") ? "page" : undefined} className={itemClass("catalog")}>
          <Icon name="catalog" />
          <span>კატალოგი</span>
        </Link>

        <Link
          href={sellHref}
          aria-current={active("sell") ? "page" : undefined}
          aria-label="განცხადების დამატება"
          className="relative -top-2 flex min-h-16 flex-col items-center justify-start gap-1 text-[10px] font-black text-brand"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_24px_rgba(7,90,83,0.28)] ring-4 ring-white">
            <Icon name="sell" />
          </span>
          <span>გაყიდე</span>
        </Link>

        <Link href={messagesHref} aria-current={active("messages") ? "page" : undefined} className={itemClass("messages")}>
          <span className="relative">
            <Icon name="messages" />
            {userState.signedIn && unreadChats > 0 ? (
              <span className="absolute -right-2.5 -top-2 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">
                {unreadChats > 99 ? "99+" : unreadChats}
              </span>
            ) : null}
          </span>
          <span>ჩათი</span>
        </Link>

        <Link href={profileHref} aria-current={active("profile") ? "page" : undefined} className={itemClass("profile")}>
          <Icon name="profile" />
          <span>პროფილი</span>
        </Link>
      </div>
    </nav>
  )
}
