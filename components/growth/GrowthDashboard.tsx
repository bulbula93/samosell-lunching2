import Link from "next/link"
import { ratio, average, type GrowthSummary, type Breakdown } from "@/lib/growth/dashboard"
import { summarizeMetaSpend, type MetaSpendSummary } from "@/lib/growth/meta-spend"
import MetaSpendPanel from "./MetaSpendPanel"
function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return <section className="ui-card min-w-0 p-5"><h2 className="text-lg font-semibold">{title}</h2>{rows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line"><th className="pb-3">წყარო</th><th className="pb-3 text-right">Visitors</th><th className="pb-3 text-right">Views</th></tr></thead><tbody>{rows.map(row => <tr key={row.label} className="border-b border-line/50"><td className="max-w-40 break-words py-3 pr-2">{row.label}</td><td className="text-right">{row.visitors}</td><td className="text-right">{row.page_views}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-text-soft">ამ პერიოდში მონაცემები ჯერ არ არის.</p>}</section>
}
export default function GrowthDashboard({ summary, period, unavailable, metaSpend, metaConfigurationIssue = "meta_credentials_missing" }: { summary: GrowthSummary | null; period: string; unavailable?: string; metaSpend?: MetaSpendSummary; metaConfigurationIssue?: string | null }) {
  const c = summary?.counts
  const metrics: [string, string | number][] = c ? [
    ["Unique visitors", c.visitors], ["Sessions", c.sessions], ["Page views", c.page_views], ["Registrations", c.registrations],
    ["Visitor → Registration", ratio(summary!.funnel[1], summary!.funnel[0])], ["Listing starts", c.listing_starts], ["Published listings", c.published_listings],
    ["Registration → Published", ratio(summary!.registered_publishers, c.registrations)], ["Unique new sellers", summary!.new_sellers], ["Listings per seller", average(c.published_listings, c.sellers)],
    ["Paid boost / banner purchases", c.purchases], ["Gross revenue · GEL", Number(c.revenue).toFixed(2)], ["Listing → Paid Boost", ratio(c.boosted_published_listings, c.published_listings)],
    ["Revenue per paying seller · GEL", average(Number(c.revenue), c.paying_sellers)], ["Average order value · GEL", average(Number(c.revenue), c.purchases)],
    ["Favorites added", summary!.favorites_added], ["Chats initiated", summary!.chats_initiated], ["Failed publish attempts", c.publish_failures],
  ] : []
  const names = ["Visitor", "Registration", "Listing Started", "Listing Published", "Paid Boost"]
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 sm:py-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/admin" className="text-sm text-brand underline">ადმინისტრირება</Link><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Growth / Analytics</h1></div><nav aria-label="პერიოდი" className="flex gap-2">{[["today", "Today"], ["7", "7 days"], ["30", "30 days"]].map(([key, label]) => <Link key={key} aria-current={period === key ? "page" : undefined} href={`/admin/growth?period=${key}`} className={period === key ? "ui-btn-primary" : "ui-btn-secondary"}>{label}</Link>)}</nav></div>
    <p className="text-sm leading-6 text-text-soft">დროის სარტყელი: თბილისი. ვიზიტორები, სესიები და ფორმის დაწყებები ითვლება analytics-ის თანხმობის შემდეგ. რეგისტრაცია, გამოქვეყნება და შემოსავალი დადასტურებული სერვერული შედეგებია. ეს მაჩვენებლები ყველა ვიზიტორის სრულ სურათს არ წარმოადგენს.</p>
    {!summary ? <section role="status" className="ui-card border-amber-200 p-6"><h2 className="text-lg font-semibold">Growth მონაცემები ჯერ მიუწვდომელია</h2><p className="mt-2 text-sm leading-6 text-text-soft">{unavailable ?? "მონაცემები ჯერ არ არის დაკავშირებული."}</p><p className="mt-2 text-sm text-text-soft">მეტრიკების ნაცვლად ნულები არ არის ნაჩვენები.</p></section> : <>
      <p className="text-sm text-text-soft">გაზომვის დასაწყისი: {summary.coverage_since ? new Date(summary.coverage_since).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi" }) : "მოვლენები ჯერ არ არის"}. ძველი მოვლენები ავტომატურად არ ითვლება.</p>
      <section aria-label="Growth metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="ui-card min-w-0 p-4 sm:p-5"><p className="break-words text-sm leading-5 text-text-soft">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums text-brand">{value}</p></div>)}</section>
      <section className="ui-card p-5"><h2 className="text-xl font-semibold">Acquisition funnel</h2><p className="mt-2 text-sm leading-6 text-text-soft">ერთი პერიოდის ვიზიტორების cohort: ყოველი მომდევნო ეტაპი იმავე ბრაუზერებს, დაკავშირებულ ანგარიშებსა და მოვლენების თანმიმდევრობას მიჰყვება. ძველი მომხმარებლების აქტივობა ზემოთ ჩანს. Banner შეძენა seller funnel-ში არ შედის.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[340px] text-left text-sm"><thead><tr className="border-b border-line"><th className="py-3">ეტაპი</th><th>რაოდენობა</th><th>Conversion</th><th>Drop-off</th></tr></thead><tbody>{names.map((name, index) => { const count = summary.funnel[index] ?? 0; const previous = summary.funnel[index - 1] ?? 0; return <tr key={name} className="border-b border-line/50"><th className="py-4 pr-3 font-medium">{name}</th><td>{count}</td><td>{index ? ratio(count, previous) : "—"}</td><td>{index && previous ? ratio(previous - count, previous) : "—"}</td></tr> })}</tbody></table></div></section>
      <div className="grid gap-4 md:grid-cols-2"><BreakdownTable title="UTM Source · first touch" rows={summary.sources} /><BreakdownTable title="UTM Campaign · first touch" rows={summary.campaigns} /></div>
      <p className="text-sm leading-6 text-text-soft">Revenue არის დადასტურებული live გადახდების ჯამი, დაბრუნებული თანხების გამოკლებამდე. Test / pending / failed გადახდები არ ითვლება. Listing views-ის არსებული მთლიანი counter პერიოდის მიხედვით სანდო არ არის და აქ არ გამოიყენება.</p>
    </>}
    <MetaSpendPanel spend={metaSpend ?? summarizeMetaSpend([], period)} growth={summary} configurationIssue={metaConfigurationIssue} />
  </main>
}
