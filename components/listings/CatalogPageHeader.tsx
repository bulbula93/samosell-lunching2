import type { getCategorySeo } from "@/lib/seo"
import { ka } from "@/lib/i18n/ka"

export default function CatalogPageHeader({
  totalCount,
  categorySeo,
}: {
  totalCount: number
  categorySeo?: ReturnType<typeof getCategorySeo>
}) {
  return (
    <header className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-6">
      <div>
        {!categorySeo ? <p className="hidden text-xs font-black uppercase tracking-[0.2em] text-brand sm:block">ქართული მეორადი ტანსაცმლის ონლაინ პლატფორმა</p> : null}
        <h1 className={categorySeo ? "w-fit text-2xl font-semibold leading-tight tracking-tight text-brand sm:text-3xl" : "w-fit text-3xl font-black leading-tight tracking-[-0.035em] text-brand sm:mt-3 sm:text-5xl"}>
          <span className="relative block pb-3">
            <span>{categorySeo?.h1 ?? ka.catalog.title}</span>
            <svg aria-hidden="true" focusable="false" viewBox="0 0 240 18" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 left-0 h-3 w-full select-none overflow-visible text-accent" fill="none">
              <path d="M5 12C58 3 139 3 232 8" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-text-soft sm:mt-2 sm:leading-7">{categorySeo?.intro ?? ka.catalog.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
        <p className="shrink-0 text-sm font-bold text-text" aria-live="polite">
          {new Intl.NumberFormat("ka-GE").format(totalCount)} ნივთი
        </p>
      </div>
    </header>
  )
}
