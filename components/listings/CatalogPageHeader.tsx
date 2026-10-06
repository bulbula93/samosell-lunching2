import { catalogCategoryHref } from "@/lib/catalog-urls"
import type { getCategorySeo } from "@/lib/seo"
import Link from "next/link"
import { ka } from "@/lib/i18n/ka"

export default function CatalogPageHeader({
  totalCount,
  giftActive = false,
  categorySeo,
  category,
}: {
  totalCount: number
  giftActive?: boolean
  categorySeo?: ReturnType<typeof getCategorySeo>
  category?: string
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {!categorySeo ? <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">ქართული მეორადი ტანსაცმლის ონლაინ პლატფორმა</p> : null}
        <h1 className={categorySeo ? "w-fit text-2xl font-semibold leading-tight tracking-tight text-brand sm:text-3xl" : "mt-3 w-fit text-4xl font-black leading-tight tracking-[-0.035em] text-brand sm:text-5xl"}>
          <span className="relative block pb-3">
            <span>{categorySeo?.h1 ?? ka.catalog.title}</span>
            <svg aria-hidden="true" focusable="false" viewBox="0 0 240 18" preserveAspectRatio="none" className="pointer-events-none absolute bottom-0 left-0 h-3 w-full select-none overflow-visible text-accent" fill="none">
              <path d="M5 12C58 3 139 3 232 8" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-text-soft">{categorySeo?.intro ?? ka.catalog.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
        <Link
          href={`${catalogCategoryHref(category)}${giftActive ? "" : "?sale_type=gift"}`}
          aria-current={giftActive ? "page" : undefined}
          className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition ${
            giftActive
              ? "border-[#f06f16] bg-[#f06f16] text-white shadow-[0_8px_20px_rgba(240,111,22,0.18)]"
              : "border-[#ffd5b2] bg-[#fff7ed] text-[#d85f0e] hover:-translate-y-0.5 hover:bg-white"
          }`}
        >
          <span aria-hidden="true">🎁</span>
          უფასოდ
        </Link>
        <p className="shrink-0 text-sm font-bold text-text" aria-live="polite">
          {new Intl.NumberFormat("ka-GE").format(totalCount)} ნივთი
        </p>
      </div>
    </header>
  )
}
