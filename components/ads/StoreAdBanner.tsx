import Link from "next/link"

type StoreAdBannerProps = {
  eyebrow?: string
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
  sizeLabel?: string
  compact?: boolean
  contained?: boolean
}

function BannerCard({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
  sizeLabel,
  compact,
}: Required<Omit<StoreAdBannerProps, "contained">>) {
  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-line bg-[linear-gradient(135deg,#fcfcfa_0%,#f3f5f2_56%,#fbfbf8_100%)] shadow-[0_12px_36px_rgba(16,24,40,0.06)] ${compact ? "p-5 sm:p-6" : "p-6 sm:p-7 lg:p-8"}`}>
      <div className="absolute -right-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-brand-soft/70 blur-3xl" />
      <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),rgba(255,255,255,0)_45%)]" />

      <div className={`relative z-10 grid gap-5 ${compact ? "lg:grid-cols-[1fr_auto] lg:items-center" : "lg:grid-cols-[1.15fr_0.85fr] lg:items-center"}`}>
        <div>
          <div className="ui-pill-soft">{eyebrow}</div>
          <h2 className={`mt-3 font-black tracking-tight text-text ${compact ? "text-2xl sm:text-[2rem]" : "text-[1.9rem] sm:text-[2.35rem]"}`}>
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-text-soft sm:text-base">
            {description}
          </p>
        </div>

        <div className="relative z-10 rounded-[1.5rem] border border-white/80 bg-white/80 p-4 shadow-[0_10px_26px_rgba(16,24,40,0.08)] backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">{sizeLabel}</div>
          <div className="mt-3 rounded-[1.15rem] border border-dashed border-brand/20 bg-surface-alt px-4 py-5 text-sm leading-6 text-text-soft">
            აქ გამოჩნდება მაღაზიის ბანერი, ახალი კოლექციის teaser, სეზონური აქცია ან კატეგორიის sponsor placement.
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={ctaHref} className="ui-btn-primary">
              {ctaLabel}
            </Link>
            <span className="ui-pill !bg-white">თვიური placement • premium exposure</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StoreAdBanner({
  eyebrow = "სარეკლამო სივრცე",
  title,
  description,
  ctaLabel = "ბანერის დაჯავშნა",
  ctaHref = "/dashboard/billing",
  sizeLabel = "Hero banner • 1200 × 220",
  compact = false,
  contained = true,
}: StoreAdBannerProps) {
  const card = (
    <BannerCard
      eyebrow={eyebrow}
      title={title}
      description={description}
      ctaLabel={ctaLabel}
      ctaHref={ctaHref}
      sizeLabel={sizeLabel}
      compact={compact}
    />
  )

  if (!contained) return card

  return (
    <section className="ui-container pb-8 sm:pb-10">
      {card}
    </section>
  )
}
