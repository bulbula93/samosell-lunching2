import { ka } from "@/lib/i18n/ka"

export default function CatalogPageHeader({ totalCount }: { totalCount: number }) {
  return (
    <header className="flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">ქართული მეორადი ტანსაცმლის ონლაინ პლატფორმა</p>
        <h1 className="mt-3 flex w-fit items-start gap-2 text-4xl font-black leading-tight tracking-[-0.035em] text-brand sm:gap-3 sm:text-5xl">
          <span className="relative isolate inline-block pb-3">
            <span>{ka.catalog.title}</span>
            <svg aria-hidden="true" focusable="false" viewBox="0 0 240 18" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 left-0 h-3 w-full overflow-visible text-accent" fill="none">
              <path d="M5 12C58 3 139 3 232 8" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </span>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 32 32" className="mt-1 h-7 w-7 shrink-0 text-accent sm:mt-2 sm:h-8 sm:w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m17 7 2.7 6.3L26 16l-6.3 2.7L17 25l-2.7-6.3L8 16l6.3-2.7L17 7Z" />
            <path d="M5 4v4M3 6h4M27 25v4M25 27h4" />
          </svg>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-text-soft">{ka.catalog.description}</p>
      </div>
      <p className="shrink-0 text-sm font-bold text-text" aria-live="polite">
        {new Intl.NumberFormat("ka-GE").format(totalCount)} ნივთი
      </p>
    </header>
  )
}
