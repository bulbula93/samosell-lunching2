import type { ReactNode } from "react"

export default function UiEmptyState({
  icon = "＋",
  title,
  description,
  actions,
  role = "status",
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  role?: "status" | "alert"
}) {
  return (
    <section
      role={role}
      className="ui-card border-dashed px-5 py-11 text-center sm:px-8 sm:py-14"
    >
      <div
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/10 bg-[linear-gradient(145deg,var(--brand-50),var(--accent-50))] text-2xl font-black text-brand shadow-[0_8px_22px_rgba(7,63,59,0.07)]"
      >
        {icon}
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.025em] text-text">{title}</h2>
      {description ? (
        <div className="mx-auto mt-3 max-w-xl text-sm leading-7 text-text-soft">{description}</div>
      ) : null}
      {actions ? <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </section>
  )
}
