import { growthPeriod } from "./shared"
import type { GrowthSummary } from "./dashboard"

export const META_AD_ACCOUNT_ID = "948841811174019"
export const META_AD_ACCOUNT_NAME = "SamoSell Ads"
export const META_AD_ACCOUNT_CURRENCY = "USD"
export const META_AD_ACCOUNT_TIMEZONE = "Asia/Tbilisi"
export const META_SPEND_QA_REF = "ydocqjdjmffysexkzxyc"

export type MetaSpendRow = {
  date: string
  ad_account_id: string
  account_name: string
  spend_amount: number | string
  spend_currency: string
  spend_gel: number | string | null
  fx_rate_to_gel: number | string | null
  fx_rate_date: string | null
  fx_source: string | null
  impressions: number | null
  clicks: number | null
  synced_at: string
}
export type MetaSpendSummary = {
  status: "ready" | "not_connected" | "unavailable" | "incomplete"
  spendUsd: number | null
  spendGel: number | null
  fxStatus: "available" | "unavailable"
  syncedAt: string | null
  daysCovered: number
  daysExpected: number
  stale: boolean
  lastError: string | null
}

// All periods use the same calendar boundaries as the authoritative Growth summary.
export function metaSpendDates(period: string, now = new Date()) {
  const range = growthPeriod(period, now)
  const dates: string[] = []
  for (let i = 0; i < range.days; i++) {
    dates.push(new Date(new Date(range.from).getTime() + 4 * 3600_000 + i * 86400_000).toISOString().slice(0, 10))
  }
  return dates
}

export function summarizeMetaSpend(rows: MetaSpendRow[], period: string, now = new Date()): MetaSpendSummary {
  const dates = metaSpendDates(period, now)
  const selected = rows.filter(row => dates.includes(row.date))
  const empty: MetaSpendSummary = { status: rows.length ? "incomplete" : "not_connected", spendUsd: null, spendGel: null, fxStatus: "unavailable", syncedAt: null, daysCovered: selected.length, daysExpected: dates.length, stale: false, lastError: null }
  if (selected.length !== dates.length || new Set(selected.map(row => row.date)).size !== dates.length) return empty
  if (selected.some(row => row.ad_account_id !== META_AD_ACCOUNT_ID || row.account_name !== META_AD_ACCOUNT_NAME || row.spend_currency !== "USD" || !Number.isFinite(Number(row.spend_amount)) || Number(row.spend_amount) < 0 || !Number.isFinite(Date.parse(row.synced_at)))) return { ...empty, status: "unavailable" }
  const syncedAt = selected.map(row => row.synced_at).sort()[0]
  const hasFx = selected.every(row => row.spend_gel !== null && Number.isFinite(Number(row.spend_gel)) && Number(row.spend_gel) >= 0 && row.fx_rate_to_gel !== null && Number(row.fx_rate_to_gel) > 0 && row.fx_source === "NBG" && Boolean(row.fx_rate_date))
  return { ...empty, status: "ready", spendUsd: selected.reduce((sum, row) => sum + Number(row.spend_amount), 0), spendGel: hasFx ? selected.reduce((sum, row) => sum + Number(row.spend_gel), 0) : null, fxStatus: hasFx ? "available" : "unavailable", syncedAt, stale: now.getTime() - Date.parse(syncedAt) > 26 * 3600_000 }
}

export function metaAcquisitionMetrics(spend: MetaSpendSummary, growth: GrowthSummary | null) {
  const gel = spend.status === "ready" ? spend.spendGel : null
  const cost = (denominator: number) => gel !== null && denominator > 0 ? gel / denominator : null
  return {
    registration: growth ? cost(growth.counts.registrations) : null,
    listing: growth ? cost(growth.counts.published_listings) : null,
    newSeller: growth ? cost(growth.new_sellers) : null,
    payingSeller: growth ? cost(growth.counts.paying_sellers) : null,
    roas: growth && gel !== null && gel > 0 ? Number(growth.counts.revenue) / gel : null,
  }
}
