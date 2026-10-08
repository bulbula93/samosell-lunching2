import { average, ratio, type GrowthSummary } from "./dashboard"
import { metaAcquisitionMetrics, type MetaSpendSummary } from "./meta-spend"
import { growthPeriod } from "./shared"

type Row = [section: string, metric: string, value: string | number]
const amount = (value: number | null) => value === null ? "unavailable" : value.toFixed(2)
const stages = ["Visitor", "Registration", "Listing Started", "Listing Published", "Paid Boost"]

// Only aggregates already authorized for the admin dashboard; no raw events or user identifiers.
export function growthExport(summary: GrowthSummary | null, spend: MetaSpendSummary, period: string, generatedAt: string, unavailable?: string) {
  const now = new Date(generatedAt)
  const range = growthPeriod(period, now)
  const rows: Row[] = [
    ["Report", "Title", "SamoSell Growth report"], ["Report", "Period", `${range.days} calendar days`],
    ["Report", "Timezone", "Asia/Tbilisi"], ["Report", "From (inclusive, UTC)", range.from], ["Report", "To (UTC)", range.to],
    ["Report", "Snapshot generated (UTC)", generatedAt], ["Growth", "Status", summary ? "available" : "unavailable"],
    ["Growth", "Coverage since (UTC)", summary?.coverage_since ?? "unavailable"],
  ]
  if (summary) {
    const c = summary.counts
    for (const key of ["visitors", "sessions", "page_views", "registrations", "listing_starts", "published_listings", "sellers", "purchases", "revenue", "paying_sellers", "banner_purchases", "publish_failures", "boosted_published_listings"] as const) rows.push(["Activity", key, c[key]])
    rows.push(["Activity", "Unique new sellers", summary.new_sellers], ["Activity", "Registered publishers", summary.registered_publishers], ["Activity", "Favorites added", summary.favorites_added], ["Activity", "Chats initiated", summary.chats_initiated],
      ["Activity", "Visitor → Registration", ratio(summary.funnel[1], summary.funnel[0])], ["Activity", "Registration → Published", ratio(summary.registered_publishers, c.registrations)],
      ["Activity", "Listings per seller", average(c.published_listings, c.sellers)], ["Activity", "Listing → Paid Boost", ratio(c.boosted_published_listings, c.published_listings)],
      ["Activity", "Revenue per paying seller · GEL", average(Number(c.revenue), c.paying_sellers)], ["Activity", "Average order value · GEL", average(Number(c.revenue), c.purchases)])
    stages.forEach((stage, index) => {
      const count = summary.funnel[index] ?? 0
      const previous = summary.funnel[index - 1] ?? 0
      rows.push(["Sequential visitor cohort", `${stage} · count`, count], ["Sequential visitor cohort", `${stage} · conversion`, index ? ratio(count, previous) : "—"], ["Sequential visitor cohort", `${stage} · drop-off`, index && previous ? ratio(previous - count, previous) : "—"])
    })
    for (const [section, breakdown] of [["UTM Source · first touch", summary.sources], ["UTM Campaign · first touch", summary.campaigns]] as const) {
      if (!breakdown.length) rows.push([section, "Status", "No data"])
      for (const item of breakdown) rows.push([section, `${item.label} · visitors`, item.visitors], [section, `${item.label} · page views`, item.page_views])
    }
  } else rows.push(["Growth", "Reason", unavailable ?? "Growth data unavailable"])
  const metrics = metaAcquisitionMetrics(spend, summary)
  const ready = spend.status === "ready"
  rows.push(["Meta", "Status", spend.status], ["Meta", "Stale", String(spend.stale)], ["Meta", "Last sync error", spend.lastError ?? "none"], ["Meta", "Last successful data sync (UTC)", spend.syncedAt ?? "unavailable"],
    ["Meta", "Days covered / expected", `${spend.daysCovered}/${spend.daysExpected}`], ["Meta", "FX status", spend.fxStatus],
    ["Meta", "Spend USD", amount(ready ? spend.spendUsd : null)], ["Meta", "Spend GEL", amount(ready ? spend.spendGel : null)],
    ["Meta", "Cost per Registration · GEL", amount(metrics.registration)], ["Meta", "Cost per Published Listing · GEL", amount(metrics.listing)],
    ["Meta", "Cost per New Seller · GEL", amount(metrics.newSeller)], ["Meta", "Paying Seller CAC · GEL", amount(metrics.payingSeller)], ["Meta", "Blended ROAS", amount(metrics.roas)])
  if (ready) for (const point of spend.dailySpend ?? []) rows.push(["Meta daily", `${point.date} · USD`, amount(point.usd)], ["Meta daily", `${point.date} · GEL`, amount(point.gel)])
  rows.push(["Notes", "Measurement", "Visitors, sessions and listing starts require analytics consent. Server-confirmed registrations, publishing and revenue are operational outcomes. Sequential funnel is one linked visitor cohort; activity totals include existing users."],
    ["Notes", "Revenue", "GEL; gross confirmed live payments before refunds. Test, pending and failed payments excluded."],
    ["Notes", "Meta", "Today's spend is provisional. GEL uses daily NBG rates. Cached spend may be shown; failed/stale sync withholds acquisition costs and ROAS. Blended ratios are not campaign attribution. — / unavailable is not zero."])
  const cell = (value: string | number) => {
    const raw = String(value)
    // Prevent spreadsheet formulas in externally supplied campaign/source labels.
    const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? `'${raw}` : raw
    return `"${safe.replaceAll('"', '""')}"`
  }
  return {
    text: rows.map(([section, metric, value]) => `[${section}] ${metric}: ${value}`).join("\n"),
    csv: "\uFEFF" + [["Section", "Metric", "Value"], ...rows].map(row => row.map(cell).join(",")).join("\r\n"),
    filename: `samosell-growth-${range.days}d-${new Date(now.getTime() + 4 * 3600_000).toISOString().slice(0, 10)}.csv`,
  }
}
