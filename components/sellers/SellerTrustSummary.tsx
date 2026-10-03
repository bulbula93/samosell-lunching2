import type { PublicSellerMetrics } from "@/lib/public-seller-metrics"

export function memberSinceLabel(createdAt?: string | null, now = new Date()) {
  if (!createdAt) return ""
  const date = new Date(createdAt)
  if (!Number.isFinite(date.getTime()) || date > now) return ""
  return `SamoSell-ზე ${date.getUTCFullYear()} წლიდან`
}

export default function SellerTrustSummary({ metrics, verified, createdAt, compact = false }: {
  metrics: PublicSellerMetrics
  verified?: boolean | null
  createdAt?: string | null
  compact?: boolean
}) {
  const { activeCount, soldCount, reviewSummary } = metrics
  const hasRating = reviewSummary.reviewCount > 0 && reviewSummary.averageScore != null
  const memberSince = memberSinceLabel(createdAt)
  const format = (value: number) => new Intl.NumberFormat("ka-GE").format(value)
  return (
    <section aria-label="გამყიდველის შესახებ" data-seller-trust className={`min-w-0 ${compact ? "mt-3" : "ui-card bg-accent-soft p-4 sm:p-6"}`}>
      {!compact ? <h2 className="text-lg font-black text-brand">გაიცანი გამყიდველი</h2> : null}
      <div className={`flex min-w-0 flex-wrap items-center gap-2 ${compact ? "" : "mt-4"}`}>
        {verified === true ? <span className="ui-pill max-w-full border-brand/20 bg-brand-soft text-sm font-bold text-brand"><span aria-hidden="true">✓ </span>დადასტურებული პროფილი</span> : null}
        <p className={`min-w-0 break-words text-sm [overflow-wrap:anywhere] ${hasRating ? "font-bold text-text" : "text-text-soft"}`}>
          {hasRating ? <><span aria-hidden="true" className="text-accent">★ </span>{reviewSummary.averageScore!.toFixed(1)} · {format(reviewSummary.reviewCount)} შეფასება</> : "ჯერ შეფასებები არ აქვს"}
        </p>
      </div>
      <dl className={`grid min-w-0 grid-cols-2 gap-2 ${compact ? "mt-3" : "mt-4"}`}>
        <div className={`min-w-0 rounded-xl ${compact ? "bg-surface-alt p-3" : "border border-line bg-surface p-4"}`}>
          <dt className="text-sm text-text-soft"><span aria-hidden="true" className="text-accent">↗ </span>გაყიდულად მონიშნული</dt>
          <dd className="mt-1 break-words text-sm font-bold text-text [overflow-wrap:anywhere]">{soldCount ? `${format(soldCount)} ნივთი` : "ჯერ გაყიდვა არ მონიშნულა"}</dd>
        </div>
        <div className={`min-w-0 rounded-xl ${compact ? "bg-surface-alt p-3" : "border border-line bg-surface p-4"}`}>
          <dt className="text-sm text-text-soft"><span aria-hidden="true" className="text-brand">▦ </span>აქტიური განცხადებები</dt>
          <dd className="mt-1 break-words text-sm font-bold text-text [overflow-wrap:anywhere]">{activeCount ? `${format(activeCount)} აქტიური ნივთი` : "ჯერ აქტიური ნივთები არ აქვს"}</dd>
        </div>
      </dl>
      {memberSince ? <p className="mt-3 break-words text-sm text-text-soft"><span aria-hidden="true">◷ </span>{memberSince}</p> : null}
      {!compact ? <p className="mt-3 text-sm leading-6 text-text-soft">გაყიდვების რაოდენობა გამყიდველის მიერ გაყიდულად მონიშნულ განცხადებებს ასახავს.</p> : null}
    </section>
  )
}
