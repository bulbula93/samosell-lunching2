"use client"

import { useEffect, useState } from "react"

type ShiftSource = { tag?: string; class?: string; previous?: { x: number; y: number; width: number; height: number }; current?: { x: number; y: number; width: number; height: number } }
type Shift = { time: number; value: number; sources?: ShiftSource[] }
type Result = { status: string; viewport: number[]; cls: number; entries: Shift[]; geometry?: Array<{ time: number; height: number; railHeight: number }> }
type Reading = { width: number; height: number; result: Result | null; error?: string }
const sizes = [[390, 844], [375, 812]] as const

export default function ClsAuditClient() {
  const [readings, setReadings] = useState<Reading[]>(sizes.map(([width, height]) => ({ width, height, result: null })))
  const [run, setRun] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setReadings(sizes.map(([width, height]) => {
        const frame = document.getElementById(`cls-frame-${width}`) as HTMLIFrameElement | null
        try {
          const output = frame?.contentDocument?.getElementById("cls-audit-result")
          const raw = output?.getAttribute("data-result")
          return { width, height, result: raw ? JSON.parse(raw) as Result : null }
        } catch {
          return { width, height, result: null, error: "შედეგის წაკითხვა ვერ მოხერხდა" }
        }
      }))
    }, 600)
    return () => window.clearInterval(timer)
  }, [run])

  return <main className="mx-auto max-w-6xl p-4 sm:p-6">
    <h1 className="text-xl font-bold">Homepage CLS — Preview audit</h1>
    <p className="my-3 text-sm">დაელოდე 20 წამს. ქვემოთ ავტომატურად გამოჩნდება შედეგები და გადანაცვლებული ელემენტები. Console საჭირო არ არის. გაზომვა სრულდება responsive iframe-ებში, არა რეალურ მოწყობილობაზე.</p>
    <button type="button" className="mb-5 rounded-lg bg-brand px-4 py-2 font-semibold text-white" onClick={() => { setRun(r => r + 1); setReadings(sizes.map(([width, height]) => ({ width, height, result: null }))) }}>ხელახლა გაზომვა</button>
    <div className="grid gap-5 md:grid-cols-2">
      {sizes.map(([width, height]) => {
        const item = readings.find(r => r.width === width)
        const result = item?.result
        const shifts = [...(result?.entries ?? [])].sort((a, b) => b.value - a.value).slice(0, 8)
        return <section key={width} className="min-w-0 rounded-xl border border-line p-3">
          <h2 className="mb-2 font-bold">{width} × {height}</h2>
          <div className="mb-3 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-900" aria-live="polite">
            <p>სტატუსი: <strong>{result?.status === "complete" ? "დასრულებულია" : item?.error ?? "მიმდინარეობს..."}</strong></p>
            <p>CLS: <strong className={result && result.cls > 0.1 ? "text-red-700" : "text-green-700"}>{result ? result.cls.toFixed(5) : "—"}</strong></p>
            <p>Layout shifts: {result?.entries.length ?? 0}</p>
          </div>
          {shifts.length ? <div className="mb-4 space-y-2"><h3 className="font-semibold">ყველაზე დიდი გადანაცვლებები</h3>{shifts.map((shift, i) => <div className="rounded-lg border border-line p-2 text-xs" key={i}>
            <p className="font-semibold">#{i + 1}: +{shift.value.toFixed(5)} · {(shift.time / 1000).toFixed(2)} წმ</p>
            {(shift.sources ?? []).slice(0, 5).map((source, j) => <p key={j} className="mt-1 break-all">{source.tag ?? "ელემენტი"} · {source.class?.slice(0, 90) || "კლასის გარეშე"} · Y: {source.previous?.y?.toFixed(0) ?? "?"} → {source.current?.y?.toFixed(0) ?? "?"}</p>)}
          </div>)}</div> : null}
          <div className="overflow-x-auto">
            <iframe key={run} id={`cls-frame-${width}`} title={`Homepage ${width}x${height}`} src={`/?_cls_audit=1&run=${run}`} width={width} height={height} style={{ border: "1px solid #777", boxSizing: "content-box" }} />
          </div>
        </section>
      })}
    </div>
  </main>
}
