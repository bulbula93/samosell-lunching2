import { formatSellerTenure } from "@/lib/seller-trust"
import type { SellerReviewSummary } from "@/types/review"

type Variant = "light" | "dark"

function ratingLabel(summary?: SellerReviewSummary | null, compact = false) {
  if (!summary || summary.reviewCount <= 0 || summary.averageScore === null) return "ჯერ არაა"
  return compact
    ? `★ ${summary.averageScore.toFixed(1)} · ${summary.reviewCount}`
    : `★ ${summary.averageScore.toFixed(1)}`
}

export default function SellerTrustSummary({
  verified,
  activeListingsCount,
  soldListingsCount,
  reviewSummary,
  createdAt,
  variant = "light",
  compact = false,
}: {
  verified: boolean
  activeListingsCount: number
  soldListingsCount: number
  reviewSummary?: SellerReviewSummary | null
  createdAt?: string | null
  variant?: Variant
  compact?: boolean
}) {
  const tenure = formatSellerTenure(createdAt)
  const dark = variant === "dark"
  const reviewCount = reviewSummary?.reviewCount ?? 0

  const items = [
    {
      label: "განცხადებები",
      value: activeListingsCount,
      helper: "აქტიური",
    },
    {
      label: "გაყიდა",
      value: soldListingsCount,
      helper: "გაყიდულად მონიშნული",
    },
    {
      label: "შეფასება",
      value: ratingLabel(reviewSummary, compact),
      helper: reviewCount > 0 ? `${reviewCount} შეფასება` : "შეფასება ჯერ არ აქვს",
    },
    {
      label: "წევრია",
      value: tenure || "—",
      helper: "SamoSell-ზე",
    },
  ]

  return (
    <section
      aria-label="გამყიდველის ნდობის მაჩვენებლები"
      className={
        dark
          ? "rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 sm:p-5"
          : "rounded-2xl border border-brand/12 bg-[linear-gradient(135deg,rgba(232,247,242,0.72),rgba(255,244,223,0.55))] p-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={dark ? "text-[11px] font-black uppercase tracking-[0.16em] text-white/55" : "text-[11px] font-black uppercase tracking-[0.16em] text-brand/60"}>
            ნდობის პროფილი
          </p>
          {!compact ? (
            <p className={dark ? "mt-1 text-sm text-white/70" : "mt-1 text-sm text-text-soft"}>
              რეალური აქტივობა და შეფასებები
            </p>
          ) : null}
        </div>

        {verified ? (
          <span className={dark
            ? "inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-black text-brand"
            : "inline-flex items-center gap-1.5 rounded-full border border-brand/15 bg-white px-3 py-1.5 text-xs font-black text-brand shadow-sm"
          }>
            <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white">✓</span>
            Verified
          </span>
        ) : (
          <span className={dark
            ? "rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60"
            : "rounded-full border border-line bg-white/80 px-3 py-1.5 text-xs font-semibold text-text-soft"
          }>
            ვერიფიკაცია არ აქვს
          </span>
        )}
      </div>

      <div className={`mt-4 grid grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
        {items.map((item) => (
          <div
            key={item.label}
            className={
              dark
                ? `min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] ${compact ? "p-3" : "p-3.5"}`
                : `min-w-0 rounded-2xl border border-white/80 bg-white/80 ${compact ? "p-3" : "p-3.5"} shadow-[0_6px_18px_rgba(7,63,59,0.04)]`
            }
          >
            <div className={dark ? "text-[10px] font-bold uppercase tracking-[0.13em] text-white/45" : "text-[10px] font-bold uppercase tracking-[0.13em] text-text-soft"}>
              {item.label}
            </div>
            <div className={dark ? "mt-1.5 break-words text-lg font-black leading-tight text-white" : "mt-1.5 break-words text-lg font-black leading-tight text-text"}>
              {item.value}
            </div>
            {!compact ? (
              <div className={dark ? "mt-1 text-[11px] leading-4 text-white/50" : "mt-1 text-[11px] leading-4 text-text-soft"}>
                {item.helper}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!compact ? (
        <p className={dark ? "mt-4 text-[11px] leading-5 text-white/45" : "mt-4 text-[11px] leading-5 text-text-soft"}>
          გაყიდვების რაოდენობა ეფუძნება გაყიდულად მონიშნულ განცხადებებს. Verified ნიშნავს SamoSell-ის მიერ დადასტურებულ პროფილს.
        </p>
      ) : null}
    </section>
  )
}
