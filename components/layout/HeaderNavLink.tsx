"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { cn } from "@/lib/ui"

type HeaderNavLinkProps = {
  href: string
  children: ReactNode
  className?: string
  activeClassName?: string
  inactiveClassName?: string
  exact?: boolean
  startsWith?: string[]
}

function normalizePathname(pathname: string) {
  if (!pathname) return "/"
  return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
}

export default function HeaderNavLink({
  href,
  children,
  className,
  activeClassName,
  inactiveClassName,
  exact = false,
  startsWith = [],
}: HeaderNavLinkProps) {
  const pathname = normalizePathname(usePathname() || "/")
  const normalizedHref = normalizePathname(href)

  const isActive = exact
    ? pathname === normalizedHref
    : pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`) || startsWith.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(className, isActive ? activeClassName : inactiveClassName)}
    >
      {children}
    </Link>
  )
}
