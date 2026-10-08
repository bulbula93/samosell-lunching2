import Link from "next/link"
import { growthExport } from "@/lib/growth/export"
import GrowthExportButtons from "./GrowthExportButtons"
import { ratio, average, type GrowthSummary, type Breakdown } from "@/lib/growth/dashboard"
import { summarizeMetaSpend, type MetaSpendSummary } from "@/lib/growth/meta-spend"
import MetaSpendPanel from "./MetaSpendPanel"
import { FunnelChart, SourceChart } from "./GrowthCharts"

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return <section className="ui-card min-w-0 p-5 sm:p-6"><h2 className="text-lg font-semibold">{title}</h2>{rows.length ? <><SourceChart rows={rows} /><details className="mt-5 text-sm"><summary className="cursor-pointer text-text-soft">ყველა მონაცემი ცხრილში</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line"><th className="pb-3">წყარო</th><th className="pb-3 text-right">Visitors</th><th className="pb-3 text-right">Views</th></tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-b border-line/50"><td className="max-w-40 break-words py-3 pr-2">{row.label}</td><td className="text-right">{row.visitors}</td><td className="text-right">{row.page_views}</td></tr>)}</tbody></table></div></details></> : <p className="mt-4 text-sm text-text-soft">ამ პერიოდში მონაცემები ჯერ არ არის.</p>}</section>
}

export default function GrowthDashboard({ summary, period, unavailable, metaSpend, metaConfigurationIssue = "meta_credentials_missing", generatedAt = new Date().toISOString() }: { summary: GrowthSummary | null; period: string; unavailable?: string; metaSpend?: MetaSpendSummary; metaConfigurationIssue?: string | null; generatedAt?: string }) {
  const report = growthExport(summary, metaSpend ?? summarizeMetaSpend([], period, new Date(generatedAt)), period, generatedAt, unavailable)
  const c = summary?.counts
  const primary: [string, string | number, string][] = c ? [
    ["Unique visitors", c.visitors, "ვიზიტორები"], ["Registrations", c.registrations, "რეგისტრაცია"], ["Published listings", c.published_listings, "გამოქვეყნებული განცხადება"], ["Gross revenue · GEL", Number(c.revenue).toFixed(2), "დადასტურებული შემოსავალი"],
  ] : []
  const secondary: [string, string | number][] = c ? [
    ["Sessions", c.sessions], ["Page views", c.page_views], ["Visitor → Registration", ratio(summary!.funnel[1], summary!.funnel[0])], ["Listing starts", c.listing_starts],
    ["Registration → Published", ratio(summary!.registered_publishers, c.registrations)], ["Unique new sellers", summary!.new_sellers], ["Listings per seller", average(c.published_listings, c.sellers)], ["Paid boost / banner purchases", c.purchases],
    ["Listing → Paid Boost", ratio(c.boosted_published_listings, c.published_listings)], ["Revenue per paying seller · GEL", average(Number(c.revenue), c.paying_sellers)], ["Average order value · GEL", average(Number(c.revenue), c.purchases)],
    ["Favorites added", summary!.favorites_added], ["Chats initiated", summary!.chats_initiated], ["Failed publish attempts", c.publish_failures],
  ] : []
  const names = ["Visitor", "Registration", "Listing Started", "Listing Published", "Paid Boost"]
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 sm:py-10">
    <header className="rounded-3xl border border-brand/10 p-5 sm:p-7" style={{ background: "linear-gradient(120deg, #eff8f6, #fff6ed)" }}>
      <div className="flex flex-wrap items-center justify-between gap-5"><div><Link href="/admin" className="text-xs font-medium text-brand">ადმინისტრირება / ზრდის მიმოხილვა</Link><h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-4xl">Growth / Analytics</h1><p className="mt-2 text-sm text-text-soft">აქტივობა, სარეკლამო ხარჯი და შედეგები ერთ სივრცეში.</p></div><nav aria-label="პერიოდი" className="flex flex-wrap gap-1 rounded-2xl border border-white/80 bg-white/70 p-1.5">{[["today", "Today"], ["7", "7 days"], ["30", "30 days"]].map(([key, label]) => <Link key={key} aria-current={period === key ? "page" : undefined} href={`/admin/growth?period=${key}`} className={`min-h-10 rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-5 ${period === key ? "bg-brand text-white shadow-sm" : "text-text-soft hover:bg-brand-soft"}`}>{label}</Link>)}</nav></div>
      <p className="mt-5 border-t border-brand/10 pt-4 text-xs leading-5 text-text-soft">დროის სარტყელი: თბილისი. ვიზიტორები, სესიები და ფორმის დაწყებები ითვლება analytics-ის თანხმობის შემდეგ. რეგისტრაცია, გამოქვეყნება და შემოსავალი დადასტურებული სერვერული შედეგებია. ეს მაჩვენებლები ყველა ვიზიტორის სრულ სურათს არ წარმოადგენს.</p>
      <GrowthExportButtons {...report} />
    </header>
    {!summary ? <section role="status" className="ui-card border-amber-200 p-6"><h2 className="text-lg font-semibold">Growth მონაცემები ჯერ მიუწვდომელია</h2><p className="mt-2 text-sm leading-6 text-text-soft">{unavailable ?? "მონაცემები ჯერ არ არის დაკავშირებული."}</p><p className="mt-2 text-sm text-text-soft">მეტრიკების ნაცვლად ნულები არ არის ნაჩვენები.</p></section> : <>
      <section aria-label="Growth metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{primary.map(([label, value, description], index) => <div key={label} className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${index === 0 ? "border-brand bg-brand text-white" : "border-line bg-white"}`}><p className={`text-[11px] leading-5 sm:text-xs ${index === 0 ? "text-white/70" : "text-text-soft"}`}>{label}</p><p className={`mt-3 break-words text-3xl font-semibold tabular-nums sm:text-4xl ${index === 0 ? "text-white" : "text-brand"}`}>{value}</p><p className={`mt-3 text-[11px] leading-5 sm:text-xs ${index === 0 ? "text-white/70" : "text-text-soft"}`}>{description}</p></div>)}</section>
      <details className="ui-card p-4 sm:p-5"><summary className="cursor-pointer text-sm font-medium text-brand">აქტივობის დეტალები · {secondary.length} მაჩვენებელი</summary><div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-4">{secondary.map(([label, value]) => <div key={label} className="min-w-0"><p className="text-xs leading-5 text-text-soft">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-brand">{value}</p></div>)}</div></details>
    </>}
    <MetaSpendPanel spend={metaSpend ?? summarizeMetaSpend([], period)} growth={summary} configurationIssue={metaConfigurationIssue} />
    {summary ? <>
      <section className="ui-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Acquisition funnel</h2><span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-brand">ერთი cohort · თანმიმდევრული ეტაპები</span></div><p className="mt-2 text-sm leading-6 text-text-soft">ერთი პერიოდის ვიზიტორების cohort: ყოველი მომდევნო ეტაპი იმავე ბრაუზერებს, დაკავშირებულ ანგარიშებსა და მოვლენების თანმიმდევრობას მიჰყვება. ძველი მომხმარებლების აქტივობა ზემოთ ჩანს. Banner შეძენა seller funnel-ში არ შედის.</p><FunnelChart counts={summary.funnel} /><details className="mt-5 text-sm"><summary className="cursor-pointer text-text-soft">Conversion და Drop-off ცხრილში</summary><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[340px] text-left text-sm"><thead><tr className="border-b border-line"><th className="py-3">ეტაპი</th><th>რაოდენობა</th><th>Conversion</th><th>Drop-off</th></tr></thead><tbody>{names.map((name, index) => { const count = summary.funnel[index] ?? 0; const previous = summary.funnel[index - 1] ?? 0; return <tr key={name} className="border-b border-line/50"><th className="py-4 pr-3 font-medium">{name}</th><td>{count}</td><td>{index ? ratio(count, previous) : "—"}</td><td>{index && previous ? ratio(previous - count, previous) : "—"}</td></tr> })}</tbody></table></div></details></section>
      <div className="grid gap-4 md:grid-cols-2"><BreakdownTable title="UTM Source · first touch" rows={summary.sources} /><BreakdownTable title="UTM Campaign · first touch" rows={summary.campaigns} /></div>
      <p className="text-xs leading-6 text-text-soft">გაზომვის დასაწყისი: {summary.coverage_since ? new Date(summary.coverage_since).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi" }) : "მოვლენები ჯერ არ არის"}. ძველი მოვლენები ავტომატურად არ ითვლება. Revenue არის დადასტურებული live გადახდების ჯამი, დაბრუნებული თანხების გამოკლებამდე. Test / pending / failed გადახდები არ ითვლება. Listing views-ის არსებული მთლიანი counter პერიოდის მიხედვით სანდო არ არის და აქ არ გამოიყენება.</p>
    </> : null}
  </main>
}
