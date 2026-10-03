import type { ReactNode } from "react"

export default function UiPageHeader({
  eyebrow,
  title,
  description,
  leading,
  actions,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  leading?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="ui-card relative overflow-hidden p-5 sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-accent-soft/80 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-brand-soft/70 blur-2xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="min-w-0">
            <p className="ui-eyebrow text-brand/75">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-brand sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <div className="mt-3 max-w-3xl text-sm leading-7 text-text-soft sm:text-base">
                {description}
              </div>
            ) : null}
          </div>
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div> : null}
      </div>
    </section>
  )
}
