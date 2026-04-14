import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/ui"

type StatIconName =
  | "listings"
  | "drafts"
  | "favorites"
  | "chats"
  | "reports"
  | "vipOrders"
  | "activeVip"

type StatCardProps = {
  label: string
  value: string | number
  href?: string
  className?: string
  iconName?: StatIconName
}

function StatIcon({ iconName }: { iconName: StatIconName }) {
  const common = "h-5 w-5"

  const icons: Record<StatIconName, ReactNode> = {
    listings: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <rect x="3.5" y="4" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="4" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13" width="7" height="7" rx="1.5" />
      </svg>
    ),
    drafts: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <path d="M7 3.75h7.5L19.25 8.5V20a1.75 1.75 0 0 1-1.75 1.75H7A1.75 1.75 0 0 1 5.25 20V5.5A1.75 1.75 0 0 1 7 3.75Z" />
        <path d="M14.25 3.75V8.5h4.75" />
        <path d="M8.5 15.5l5.75-5.75 1.75 1.75-5.75 5.75L8 17.5l.5-2Z" />
      </svg>
    ),
    favorites: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <path d="M12 20.25s-7-4.35-7-10.05A4.2 4.2 0 0 1 9.2 6c1.2 0 2.15.45 2.8 1.35C12.65 6.45 13.6 6 14.8 6A4.2 4.2 0 0 1 19 10.2c0 5.7-7 10.05-7 10.05Z" />
      </svg>
    ),
    chats: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <path d="M6 18.25 3.75 20V7A3.25 3.25 0 0 1 7 3.75h10A3.25 3.25 0 0 1 20.25 7v6A3.25 3.25 0 0 1 17 16.25H9.5L6 18.25Z" />
        <path d="M8 8.75h8M8 12.25h5.5" />
      </svg>
    ),
    reports: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <path d="M6 20.25V4.25" />
        <path d="M6 5.25h10.25l-1.5 3.25 1.5 3.25H6" />
      </svg>
    ),
    vipOrders: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <path d="m5 16 2.25-7 4.75 4 4.75-4L19 16" />
        <path d="M6.25 18.75h11.5" />
        <path d="m8.25 9.5 2-3 1.75 2.5L13.75 6.5l2 3" />
      </svg>
    ),
    activeVip: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={common} aria-hidden="true">
        <path d="m12 3.75 2.2 4.45 4.9.7-3.55 3.45.85 4.88L12 14.9l-4.4 2.35.85-4.88L4.9 8.9l4.9-.7L12 3.75Z" />
      </svg>
    ),
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/15 bg-brand/[0.07] text-brand transition duration-200 group-hover:scale-[1.03] group-hover:bg-brand/[0.12]">
      {icons[iconName]}
    </div>
  )
}

export default function StatCard({ label, value, href, className, iconName }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-soft">{label}</div>
          <div className="mt-2 text-3xl font-black text-text">{value}</div>
        </div>
        {iconName ? <StatIcon iconName={iconName} /> : null}
      </div>
      {href ? (
        <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-text-soft transition group-hover:text-text">
          <span>გახსნა</span>
          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span>
        </div>
      ) : null}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "ui-card ui-card-hover group block p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
          className,
        )}
      >
        {content}
      </Link>
    )
  }

  return <div className={cn("ui-card p-5", className)}>{content}</div>
}
