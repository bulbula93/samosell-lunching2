"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import SignOutButton from "@/components/dashboard/SignOutButton"
import MarketplaceSearch from "@/components/layout/MarketplaceSearch"
import { ka } from "@/lib/i18n/ka"

export type MarketplaceNavItem = {
  label: string
  href: string
}

export type MarketplaceUserState = {
  signedIn: boolean
  profileLabel: string
  profileImage: string | null
  isAdmin: boolean
  unreadNotifications: number
}

export default function MobileNavigation({
  items,
  userState,
}: {
  items: MarketplaceNavItem[]
  userState: MarketplaceUserState
}) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return

    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setOpen(false)
        return
      }

      if (event.key !== "Tab" || !dialogRef.current) return
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
      trigger?.focus()
    }
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ka.nav.menu}
        aria-expanded={open}
        aria-controls="mobile-marketplace-menu"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-xl font-bold text-text transition hover:border-brand/40 hover:bg-brand-soft/40"
      >
        ☰
        {userState.signedIn && userState.unreadNotifications > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-black leading-none text-white">
            {userState.unreadNotifications > 99 ? "99+" : userState.unreadNotifications}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label={ka.nav.closeMenu}
            className="absolute inset-0 bg-text/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div
            ref={dialogRef}
            id="mobile-marketplace-menu"
            role="dialog"
            aria-modal="true"
            aria-label="მობილური ნავიგაცია"
            className="absolute inset-y-0 right-0 flex w-[min(92vw,390px)] flex-col overflow-y-auto bg-bg shadow-[-24px_0_60px_rgba(7,63,59,0.18)]"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Link href="/" onClick={() => setOpen(false)} className="font-logo text-2xl font-black tracking-[-0.04em] text-brand">
                {ka.brand}
              </Link>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={ka.nav.closeMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-2xl text-text"
              >
                ×
              </button>
            </div>

            <div className="border-b border-line p-5">
              <MarketplaceSearch compact id="mobile-menu-marketplace-search" />
            </div>

            <nav aria-label="მობილური კატეგორიები" className="p-3">
              <Link
                href="/catalog"
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center rounded-xl px-4 text-base font-bold text-text transition hover:bg-brand-soft"
              >
                {ka.nav.catalog}
              </Link>
              {items.map((item) => (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-xl px-4 text-base font-medium text-text-soft transition hover:bg-brand-soft hover:text-brand"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-auto space-y-3 border-t border-line p-5">
              <Link href="/dashboard/listings/new" onClick={() => setOpen(false)} className="ui-btn-primary w-full">
                {ka.nav.sell}
              </Link>
              {userState.signedIn ? (
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="ui-btn-secondary col-span-2 justify-between">
                    <span>შეტყობინებები</span>
                    {userState.unreadNotifications > 0 ? (
                      <span className="rounded-full bg-brand px-2 py-1 text-xs font-black text-white">
                        {userState.unreadNotifications > 99 ? "99+" : userState.unreadNotifications}
                      </span>
                    ) : null}
                  </Link>
                  <Link href="/dashboard/chats" onClick={() => setOpen(false)} className="ui-btn-secondary">
                    {ka.nav.messages}
                  </Link>
                  <Link href="/dashboard/favorites" onClick={() => setOpen(false)} className="ui-btn-secondary">
                    {ka.nav.favorites}
                  </Link>
                  <Link href="/dashboard/orders" onClick={() => setOpen(false)} className="ui-btn-secondary">
                    შეკვეთები
                  </Link>
                  <Link href="/dashboard/profile" onClick={() => setOpen(false)} className="ui-btn-secondary col-span-2">
                    {userState.profileLabel}
                  </Link>
                  <Link href="/dashboard/billing" onClick={() => setOpen(false)} className="ui-btn-secondary">
                    VIP განთავსება
                  </Link>
                  <Link href="/dashboard/reports" onClick={() => setOpen(false)} className="ui-btn-secondary">
                    რეპორტები
                  </Link>
                  {userState.isAdmin ? (
                    <Link href="/admin" onClick={() => setOpen(false)} className="ui-btn-secondary col-span-2">
                      ადმინისტრირება
                    </Link>
                  ) : null}
                  <SignOutButton className="ui-btn-secondary col-span-2 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/login" onClick={() => setOpen(false)} className="ui-btn-secondary">
                    {ka.nav.login}
                  </Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="ui-btn-secondary">
                    {ka.nav.register}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
