"use client"

import { useId, useState } from "react"
import type { MetaSpendPoint } from "@/lib/growth/meta-spend"

const dateLabel = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`
export default function MetaSpendChart({ points, fxAvailable }: { points: MetaSpendPoint[]; fxAvailable: boolean }) {
  const [currency, setCurrency] = useState<"USD" | "GEL">("USD")
  const [selected, setSelected] = useState<number | null>(null)
  const gradientId = useId()
  // Missing FX never becomes a zero GEL series, including after a period change.
  const activeCurrency = currency === "GEL" && fxAvailable ? "GEL" : "USD"
  const values = points.map(point => activeCurrency === "USD" ? point.usd : point.gel!)
  const maximum = Math.max(0, ...values)
  const ceiling = maximum > 0 ? maximum * 1.2 : 1
  const left = 44, right = 684, top = 24, bottom = 204
  const x = (index: number) => points.length === 1 ? (left + right) / 2 : left + index / (points.length - 1) * (right - left)
  const y = (value: number) => bottom - value / ceiling * (bottom - top)
  const line = points.map((_, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(values[index]).toFixed(2)}`).join(" ")
  const area = points.length > 1 && maximum > 0 ? `${line} L${right},${bottom} L${left},${bottom} Z` : null
  const activeIndex = selected !== null && selected < points.length ? selected : points.length - 1
  const ticks = maximum > 0 ? [ceiling, ceiling / 2, 0] : [0]
  const labels = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]
  if (!points.length) return null
  return <section aria-label="Daily Meta spend chart" className="min-w-0 rounded-2xl border border-brand/10 bg-brand-soft/20 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-medium uppercase tracking-widest text-text-soft">META ADS · DAILY</p><h3 className="mt-1 text-base font-semibold">ხარჯის დინამიკა</h3></div>
      <div aria-label="გრაფიკის ვალუტა" className="flex rounded-full border border-line bg-white p-1">{(["USD", "GEL"] as const).map(unit => <button key={unit} type="button" aria-pressed={activeCurrency === unit} disabled={unit === "GEL" && !fxAvailable} onClick={() => setCurrency(unit)} className={`min-h-9 rounded-full px-4 text-xs font-semibold transition disabled:opacity-35 ${activeCurrency === unit ? "bg-brand text-white" : "text-text-soft hover:bg-brand-soft"}`}>{unit}</button>)}</div>
    </div>
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="text-text-soft">{dateLabel(points[activeIndex].date)} · <strong className="font-semibold tabular-nums text-brand">{values[activeIndex].toFixed(2)}</strong> {activeCurrency}</span><span className="text-xs text-text-soft">{maximum === 0 ? "ამ პერიოდში ხარჯი არ არის" : "დღე აირჩიე ქვედა ზოლზე"}</span></div>
    <svg viewBox="0 0 720 244" role="img" aria-label={`Meta Ads-ის დღიური ხარჯი ${activeCurrency}; ${points.length} დღე`} className="mt-2 block w-full overflow-visible">
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#086c62" stopOpacity="0.2" /><stop offset="100%" stopColor="#086c62" stopOpacity="0" /></linearGradient></defs>
      {ticks.map(tick => <g key={tick}><line x1={left} y1={y(tick)} x2={right} y2={y(tick)} stroke="#cbded8" strokeDasharray="4 5" /><text x={left - 9} y={y(tick) + 4} textAnchor="end" fill="#52615e" fontSize="11">{tick < 10 ? tick.toFixed(2) : tick.toFixed(0)}</text></g>)}
      {area ? <path d={area} fill={`url(#${gradientId})`} /> : null}
      <path d={line} fill="none" stroke="#075a53" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1={x(activeIndex)} y1={top} x2={x(activeIndex)} y2={bottom} stroke="#e9964f" strokeDasharray="3 5" opacity="0.8" />
      <circle cx={x(activeIndex)} cy={y(values[activeIndex])} r="5" fill="#e9964f" stroke="white" strokeWidth="2" />
      {labels.map(index => <text key={index} x={x(index)} y={230} textAnchor="middle" fill="#52615e" fontSize="11">{dateLabel(points[index].date)}</text>)}
    </svg>
    <input type="range" aria-label="აირჩიე ხარჯის დღე" aria-valuetext={`${points[activeIndex].date}: ${values[activeIndex].toFixed(2)} ${activeCurrency}`} min="0" max={points.length - 1} step="1" value={activeIndex} disabled={points.length === 1} onChange={event => setSelected(Number(event.target.value))} className="block min-h-11 w-full accent-brand sm:hidden" />
    <div aria-label="ხარჯის დღეები" className="mt-1 hidden gap-0.5 sm:flex">{points.map((point, index) => <button key={point.date} type="button" aria-label={`${point.date}: ${values[index].toFixed(2)} ${activeCurrency}`} aria-pressed={index === activeIndex} onFocus={() => setSelected(index)} onClick={() => setSelected(index)} onPointerEnter={() => setSelected(index)} className={`h-8 min-w-0 flex-1 rounded-md border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${index === activeIndex ? "border-accent bg-accent-soft" : "border-brand/10 bg-white hover:border-brand/40"}`}><span className="sr-only">{dateLabel(point.date)}</span></button>)}</div>
    <details className="mt-3 text-xs text-text-soft"><summary className="cursor-pointer py-1">დღიური მონაცემები · {points.length} დღე</summary><div className="mt-2 max-h-48 overflow-auto rounded-xl border border-line bg-white p-3"><table className="w-full text-left tabular-nums"><caption className="sr-only">Meta Ads-ის შენახული დღიური ხარჯი</caption><thead><tr><th className="pb-2">თარიღი</th><th className="pb-2 text-right">USD</th><th className="pb-2 text-right">GEL</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><th className="py-1 font-normal">{point.date}</th><td className="text-right">{point.usd.toFixed(2)}</td><td className="text-right">{point.gel === null ? "კურსი მიუწვდომელია" : point.gel.toFixed(2)}</td></tr>)}</tbody></table></div></details>
  </section>
}
