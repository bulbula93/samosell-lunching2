import type { SellerTrustSignal } from "@/lib/seller-trust"

type SellerTrustBadgesProps = {
  signals: SellerTrustSignal[]
  variant?: "light" | "dark"
  compact?: boolean
  className?: string
}

const signalMark: Record<SellerTrustSignal["key"], string> = {
  verified: "✓",
  phone: "☎",
  profile: "✓",
  reviews: "★",
  sold: "✓",
  tenure: "◷",
}

function badgeClasses(
  tone: SellerTrustSignal["tone"],
  variant: "light" | "dark",
) {
  if (variant === "dark") {
    if (tone === "verified") return "border-white/25 bg-white text-brand"
    if (tone === "positive") return "border-white/15 bg-white/10 text-white"
    return "border-white/10 bg-white/5 text-white/80"
  }

  if (tone === "verified") return "border-brand/25 bg-brand-soft text-brand"
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-900"
  return "border-line bg-surface-alt text-text-soft"
}

export default function SellerTrustBadges({
  signals,
  variant = "light",
  compact = false,
  className = "",
}: SellerTrustBadgesProps) {
  if (signals.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} aria-label="გამყიდველის ნდობის სიგნალები">
      {signals.map((signal) => (
        <span
          key={signal.key}
          title={signal.detail}
          className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${
            compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-2 text-xs"
          } ${badgeClasses(signal.tone, variant)}`}
        >
          <span aria-hidden="true">{signalMark[signal.key]}</span>
          <span>{signal.label}</span>
        </span>
      ))}
    </div>
  )
}
