import Link from "next/link"
import type { BuyerLiquiditySnapshot } from "@/lib/growth/liquidity-server"

function percent(part: number, total: number) {
  if (total <= 0) return "—"
  return `${(part / total * 100).toFixed(1)}%`
}
function number(value: number) {
  return new Intl.NumberFormat("ka-GE").format(value)
}
function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5">
    <p className="text-xs font-medium text-text-soft">{title}</p>
    <p className="mt-2 text-3xl font-bold tabular-nums text-brand">{value}</p>
    <p className="mt-3 text-xs leading-5 text-text-soft">{note}</p>
  </article>
}
function DayBars({ data }: { data: BuyerLiquiditySnapshot["daily"] }) {
  const max = Math.max(1,...data.map(day => Math.max(day.impressions, day.clicks, day.detail_views)))
  return <section className="ui-card p-5 sm:p-6">
    <h2 className="text-lg font-semibold">დღიური აქტივობა</h2>
    <p className="mt-1 text-sm text-text-soft">თითო სვეტი კონკრეტულ დღეს ასახავს თბილისის დროით. მოვლენების რაოდენობა უნიკალურ ადამიანებს არ უდრის.</p>
    <div className="mt-5 flex items-end gap-1 overflow-x-auto border-b border-line pb-3" style={{ minHeight: 156 }}>
      {data.map(day => <div key={day.day} className="flex min-w-5 flex-1 flex-col items-center gap-2" title={`${day.day} · ნახეს კატალოგში ${day.impressions}, დააჭირეს ${day.clicks}, გახსნეს ${day.detail_views}`}>
        <div className="flex h-28 items-end gap-0.5">
          <div className="w-1.5 rounded-t bg-emerald-600" style={{ height: `${Math.max(day.impressions ? 5 : 0,day.impressions/max*100)}%` }}/>
          <div className="w-1.5 rounded-t bg-amber-400" style={{ height: `${Math.max(day.clicks ? 5 : 0,day.clicks/max*100)}%` }}/>
          <div className="w-1.5 rounded-t bg-sky-500" style={{ height: `${Math.max(day.detail_views ? 5 : 0,day.detail_views/max*100)}%` }}/>
        </div>
        <span className="text-[10px] text-text-soft">{day.day.slice(5)}</span>
      </div>)}
    </div>
    <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-soft"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600"/>Impressions</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-400"/>Clicks</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500"/>Listing Views</span></div>
  </section>
}
export default function BuyerLiquidityDashboard({ snapshot, error, period, generatedAt }: {
  snapshot: BuyerLiquiditySnapshot | null
  error: string | null
  period: string
  generatedAt: string
}) {
  const lowSample = snapshot && snapshot.impressions < 100
  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-7 sm:px-6 sm:py-10">
    <header className="rounded-3xl border border-brand/10 bg-brand-soft/50 p-5 sm:p-7">
      <Link href="/admin/growth" className="text-sm font-medium text-brand hover:underline">← Growth / Analytics</Link>
      <h1 className="mt-3 text-2xl font-semibold sm:text-4xl">Buyer Liquidity</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-text-soft">რომელ ნივთებს ხედავენ, რომლებზე გადადიან და რამდენჯერ იხსნება მათი გვერდები — მხოლოდ Analytics თანხმობით გაზომილი აქტივობა.</p>
      <nav aria-label="პერიოდის არჩევა" className="mt-5 flex gap-2">
        {([["today","დღეს"],["7","7 დღე"],["30","30 დღე"]] as const).map(([value,label]) => <Link key={value} aria-current={period===value?"page":undefined} href={`/admin/liquidity?period=${value}`} className={`rounded-full border px-4 py-2 text-sm font-semibold ${period===value?"border-brand bg-brand text-white":"border-line bg-white text-brand"}`}>{label}</Link>)}
      </nav>
      <p className="mt-4 text-xs text-text-soft">თბილისის დრო · განახლდა {new Date(generatedAt).toLocaleString("ka-GE",{timeZone:"Asia/Tbilisi"})}</p>
    </header>

    {error || !snapshot ? <section role="status" className="ui-card border-amber-300 p-5"><h2 className="font-semibold">მონაცემები მიუწვდომელია</h2><p className="mt-2 text-sm text-text-soft">{error ?? "სცადეთ მოგვიანებით."}</p></section> : <>
      <section aria-label="Buyer Liquidity metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric title="Catalog Impressions" value={number(snapshot.impressions)} note="ბარათის 50% ≥ 800 ms ეკრანზე"/>
        <Metric title="Catalog Clicks" value={number(snapshot.clicks)} note="მხოლოდ განცხადებაზე გადასვლის ბმულები"/>
        <Metric title="Listing Views" value={number(snapshot.detail_views)} note="მაქს. ერთხელ ვიზიტორზე / ნივთზე / UTC დღეზე"/>
        <Metric title="Catalog CTR" value={percent(snapshot.clicks,snapshot.impressions)} note="კლიკების / გამოჩენების თანაფარდობა; არა მომხმარებელთა კონვერსია"/>
      </section>
      {lowSample ? <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">მცირე ნიმუშია (100-ზე ნაკლები impression). პირველ დღეებში სატესტო აქტივობაც შეიძლება შედიოდეს — დასკვნები მხოლოდ საკმარისი მონაცემების დაგროვების შემდეგ გააკეთეთ.</p> : null}
      <section className="grid gap-3 md:grid-cols-3">
        <Metric title="აქტიური განცხადებები" value={number(snapshot.active_listings)} note="ყველა საჯაროდ აქტიური განცხადება"/>
        <Metric title="დაფიქსირდა გამოჩენა" value={number(snapshot.listings_with_impressions)} note="ამ პერიოდში ≥1 გაზომილი Impression"/>
        <Metric title="დაფიქსირდა ნახვა" value={number(snapshot.listings_with_views)} note="ამ პერიოდში ≥1 გაზომილი Listing View"/>
      </section>
      <DayBars data={snapshot.daily}/>
      <section className="ui-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">განცხადებების შედარება</h2><span className="text-xs text-text-soft">პირველი 15 · სორტირება Impression / Click / Views</span></div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead><tr className="border-b border-line text-text-soft"><th className="px-2 py-3">განცხადება</th><th className="px-2 py-3 text-right">Impressions</th><th className="px-2 py-3 text-right">Clicks</th><th className="px-2 py-3 text-right">Views</th><th className="px-2 py-3 text-right">CTR</th></tr></thead>
            <tbody>{snapshot.top_listings.map(item => <tr key={item.id} className="border-b border-line/50"><td className="max-w-[280px] px-2 py-3">{item.slug ? <Link className="font-medium text-brand hover:underline" href={`/listing/${encodeURIComponent(item.slug)}`}>{item.title}</Link> : <span>{item.title}</span>}</td><td className="px-2 py-3 text-right tabular-nums">{number(item.impressions)}</td><td className="px-2 py-3 text-right tabular-nums">{number(item.clicks)}</td><td className="px-2 py-3 text-right tabular-nums">{number(item.detail_views)}</td><td className="px-2 py-3 text-right tabular-nums">{percent(item.clicks,item.impressions)}</td></tr>)}</tbody>
          </table>
          {!snapshot.top_listings.length ? <p className="mt-5 text-sm text-text-soft">აქტიური განცხადებები ვერ მოიძებნა.</p> : null}
        </div>
      </section>
      <p className="text-xs leading-6 text-text-soft">ახალი ანალიტიკის დასაწყისი: 2026 წლის 12 ოქტომბერი. ძველი listings.views_count აქ არ გამოიყენება. პერიოდული დეტალური მონაცემები 35 დღეში იშლება; ყველა დროის ახალი დათვლების ჯამი შენარჩუნებულია ({number(snapshot.lifetime_measured_views)}). Analytics-ზე უარის მქონე ვიზიტორები არ ითვლება. ერთი კლიკი და ერთი ნახვა ერთი და იმავე ადამიანის თანმიმდევრულ მოქმედებად არ ითვლება.</p>
    </>}
  </main>
}
