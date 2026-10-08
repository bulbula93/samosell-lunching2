import type { GrowthSummary } from "@/lib/growth/dashboard"
import { META_AD_ACCOUNT_ID, META_AD_ACCOUNT_NAME, metaAcquisitionMetrics, type MetaSpendSummary } from "@/lib/growth/meta-spend"
import MetaSpendSyncButton from "./MetaSpendSyncButton"
import MetaSpendChart from "./MetaSpendChart"
import { CostChart } from "./GrowthCharts"

const money = (value: number | null, currency: string) => value === null ? "—" : `${value.toFixed(2)} ${currency}`
export default function MetaSpendPanel({ spend, growth, configurationIssue }: { spend: MetaSpendSummary; growth: GrowthSummary | null; configurationIssue: string | null }) {
  const metrics = metaAcquisitionMetrics(spend, growth)
  const available = spend.status === "ready"
  const cards = [
    ["Meta Spend · USD", money(spend.spendUsd, "USD")],
    ["Meta Spend · GEL", money(spend.spendGel, "GEL")],
    ["Cost per Registration", money(metrics.registration, "GEL")],
    ["Cost per Published Listing", money(metrics.listing, "GEL")],
    ["Cost per New Seller", money(metrics.newSeller, "GEL")],
    ["Paying Seller CAC", money(metrics.payingSeller, "GEL")],
    ["Blended ROAS", metrics.roas === null ? "—" : `${metrics.roas.toFixed(2)}×`],
  ]
  return <section aria-label="Meta spend and acquisition costs" className="ui-card space-y-5 overflow-hidden border-brand/15 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Meta Ads Spend / CAC / ROAS</h2><p className="mt-2 break-words text-sm text-text-soft">{META_AD_ACCOUNT_NAME} · {META_AD_ACCOUNT_ID} · USD · Asia/Tbilisi</p></div><MetaSpendSyncButton configurationIssue={configurationIssue} /></div>
    {!available ? <p role="status" className="text-sm text-text-soft">{spend.status === "not_connected" ? "Not connected · Meta spend ჯერ არ არის სინქრონიზებული." : spend.status === "incomplete" ? `Spend unavailable · სრული პერიოდი არ არის დაფარული (${spend.daysCovered}/${spend.daysExpected} დღე).` : "Spend unavailable · შენახული Meta მონაცემების წაკითხვა ვერ მოხერხდა."}</p> : null}
    {available && (spend.lastError || spend.stale) ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p>{spend.lastError === "meta_authorization_failed" ? "Meta-სთან წვდომა ვერ დადასტურდა. საჭიროა მოქმედი token, ads_read უფლება და SamoSell Ads ანგარიშზე წვდომა." : spend.lastError ? "ბოლო სინქრონიზაცია ვერ შესრულდა." : "Meta ხარჯის განახლება საჭიროა."}</p><p className="mt-2">ქვემოთ ჩანს ბოლო წარმატებული სინქრონიზაციის ხარჯი; მიმდინარე ხარჯი დაუდასტურებელია. განახლებამდე CAC, ერთეულის ღირებულება და ROAS არ ითვლება.</p></div> : null}
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value], index) => <div key={label} className={`min-w-0 rounded-2xl p-4 ${index < 2 ? "border border-brand/15 bg-brand-soft/40" : "border border-line bg-white"}`}><dt className="text-xs leading-5 text-text-soft sm:text-sm">{label}</dt><dd className="mt-2 break-words text-xl font-semibold tabular-nums text-brand sm:text-2xl">{value}</dd></div>)}</dl>
    {available && spend.dailySpend?.length ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"><MetaSpendChart key={`${spend.dailySpend[0].date}/${spend.dailySpend[spend.dailySpend.length - 1].date}`} points={spend.dailySpend} fxAvailable={spend.fxStatus === "available"} /><CostChart costs={[
      { label: "რეგისტრაცია", value: metrics.registration }, { label: "გამოქვეყნებული განცხადება", value: metrics.listing }, { label: "ახალი გამყიდველი", value: metrics.newSeller }, { label: "გადამხდელი გამყიდველი / CAC", value: metrics.payingSeller },
    ]} /></div> : null}
    {available && spend.fxStatus === "unavailable" ? <p role="status" className="text-sm text-amber-700">FX unavailable · პერიოდის ყველა დღისთვის ოფიციალური კურსი არ გვაქვს. GEL ხარჯი, CAC და ROAS მიუწვდომელია.</p> : null}
    {available && spend.fxStatus === "available" ? <p className="text-sm text-text-soft">FX: NBG-ის ოფიციალური USD/GEL კურსი ხარჯის თითოეული დღის მიხედვით; პირველი წარმატებული კურსი და მისი თარიღი შენახულია.</p> : null}
    {spend.syncedAt ? <p className="text-sm text-text-soft">Meta მონაცემების დრო: {new Date(spend.syncedAt).toLocaleString("ka-GE", { timeZone: "Asia/Tbilisi" })}{spend.stale ? " · განახლება საჭიროა" : ""}. დღევანდელი ხარჯი წინასწარია; Meta-ის ანგარიშგებას შესაძლოა დაგვიანება ჰქონდეს.</p> : null}
    {!growth ? <p className="text-sm text-text-soft">Growth მონაცემები მიუწვდომელია; ერთეულის ღირებულება და ROAS ვერ ითვლება.</p> : null}
    <p className="text-sm leading-6 text-text-soft">Revenue = authoritative confirmed live Growth revenue · GEL. Test / pending / failed გადახდები არ შედის; შემოსავალი gross არის, დაბრუნებული თანხების გამოკლებამდე. Meta spend = Meta Ads reported spend. ერთეულის ღირებულება = პერიოდის GEL ხარჯი / შესაბამისი რაოდენობა. Blended ROAS = პერიოდის Growth revenue GEL / Meta spend GEL; ეს ანგარიშის საერთო მაჩვენებელია და campaign-attributed ROAS არ არის. ნულოვანი denominator-ისას ჩანს —. გაზომვის დაწყებამდე Growth შედეგები ამ შედარებაში არ აღდგება.</p>
  </section>
}
