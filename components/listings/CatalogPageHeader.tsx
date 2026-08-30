import { ka } from "@/lib/i18n/ka"

export default function CatalogPageHeader({ totalCount }: { totalCount: number }) {
  return (
    <header className="flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">ქართული მეორადი ტანსაცმლის ონლაინ პლატფორმა</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-text sm:text-4xl">{ka.catalog.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-text-soft">{ka.catalog.description}</p>
      </div>
      <p className="shrink-0 text-sm font-bold text-text" aria-live="polite">
        {new Intl.NumberFormat("ka-GE").format(totalCount)} ნივთი
      </p>
    </header>
  )
}
