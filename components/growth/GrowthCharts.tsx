import type { Breakdown } from "@/lib/growth/dashboard"

const funnelNames = ["Visitor", "Registration", "Listing Started", "Listing Published", "Paid Boost"]
const colors = ["#075a53", "#158b78", "#5ea897", "#e9964f", "#d47d34"]

export function FunnelChart({ counts }: { counts: number[] }) {
  const maximum = Math.max(0, ...counts)
  return <figure aria-label="Acquisition funnel chart" className="mt-6 space-y-4">
    {funnelNames.map((name, index) => {
      const count = counts[index] ?? 0
      const width = maximum > 0 ? count / maximum * 100 : 0
      return <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[150px_minmax(0,1fr)_50px]">
        <span className="flex items-center gap-2 text-xs text-text-soft sm:text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand">{index + 1}</span>{name}</span>
        <div className="order-3 col-span-2 h-8 overflow-hidden rounded-lg bg-brand-soft/50 sm:order-none sm:col-span-1"><div className="h-full rounded-lg" style={{ width: `${width}%`, backgroundColor: colors[index] }} /></div>
        <span className="text-right text-xl font-semibold tabular-nums text-brand">{count}</span>
      </div>
    })}
    <figcaption className="pt-1 text-xs text-text-soft">ზოლის სიგრძე იმავე cohort-ის რეალურ რაოდენობას ასახავს.</figcaption>
  </figure>
}

export function SourceChart({ rows }: { rows: Breakdown[] }) {
  const total = rows.reduce((sum, row) => sum + row.visitors, 0)
  const top = [...rows].sort((a, b) => b.visitors - a.visitors).slice(0, 6)
  if (!top.length) return null
  return <figure aria-label="Visitor source chart" className="mt-5 space-y-4">{top.map((row, index) => <div key={row.label}>
    <div className="mb-2 flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words text-text-soft">{row.label}</span><span className="shrink-0 font-semibold tabular-nums text-brand">{row.visitors}<span className="ml-2 text-xs font-normal text-text-soft">{total > 0 ? `${(row.visitors / total * 100).toFixed(1)}%` : "0%"}</span></span></div>
    <div className="h-3 overflow-hidden rounded-full bg-brand-soft/60"><div className="h-full rounded-full" style={{ width: `${total > 0 ? row.visitors / total * 100 : 0}%`, backgroundColor: colors[index % colors.length] }} /></div>
  </div>)}<figcaption className="text-xs text-text-soft">{rows.length > 6 ? "6 ყველაზე დიდი წყარო · პროცენტები ყველა წყაროს მიხედვით" : "წილი ამ პერიოდის ვიზიტორებში"}</figcaption></figure>
}

export function CostChart({ costs }: { costs: { label: string; value: number | null }[] }) {
  const maximum = Math.max(0, ...costs.map(cost => cost.value ?? 0))
  return <section aria-label="Acquisition cost comparison" className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5"><p className="text-xs font-medium uppercase tracking-widest text-text-soft">ACQUISITION · GEL</p><h3 className="mt-1 text-base font-semibold">ერთეულის ღირებულება</h3><div className="mt-5 space-y-5">{costs.map((cost, index) => <div key={cost.label}><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-text-soft">{cost.label}</span><span className="font-semibold tabular-nums text-brand">{cost.value === null ? "მიუწვდომელია" : `${cost.value.toFixed(2)} ₾`}</span></div><div className="h-3 overflow-hidden rounded-full bg-brand-soft/50"><div className="h-full rounded-full" style={{ width: `${cost.value !== null && maximum > 0 ? cost.value / maximum * 100 : 0}%`, backgroundColor: colors[index] }} /></div></div>)}</div><p className="mt-5 text-xs leading-5 text-text-soft">პერიოდის Meta ხარჯი GEL-ში / შესაბამისი შედეგების რაოდენობა. ნულოვანი რაოდენობისას ღირებულება მიუწვდომელია.</p></section>
}
