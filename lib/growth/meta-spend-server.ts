import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { META_AD_ACCOUNT_ID, META_AD_ACCOUNT_NAME, META_SPEND_QA_REF, metaSpendDates, summarizeMetaSpend, type MetaSpendRow, type MetaSpendSummary } from "./meta-spend"
import { fetchMetaDailySpend, fetchNbgRate, MetaSpendError } from "./meta-spend-source"

export function metaSpendBackendAllowed() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true") return false
  if (process.env.VERCEL_ENV === "production") return url === "https://lxsvjzbiuewgwpajqrwr.supabase.co"
  // Local development and all other environments also fail closed to the named QA project.
  return process.env.PREVIEW_GROWTH_DATABASE_REF === META_SPEND_QA_REF && url === `https://${META_SPEND_QA_REF}.supabase.co`
}
export function metaSpendConfigurationStatus(): string | null {
  if (!metaSpendBackendAllowed()) return "meta_backend_not_allowed"
  if (process.env.META_ADS_SPEND_ENABLED !== "true") return "meta_sync_disabled"
  if (process.env.META_ADS_AD_ACCOUNT_ID !== META_AD_ACCOUNT_ID) return "meta_account_not_configured"
  if (!process.env.META_ADS_ACCESS_TOKEN || !/^v\d+\.0$/.test(process.env.META_ADS_GRAPH_API_VERSION ?? "")) return "meta_credentials_missing"
  return null
}

export async function readMetaSpend(period: string, now = new Date()): Promise<MetaSpendSummary> {
  const fallback = summarizeMetaSpend([], period, now)
  if (!metaSpendBackendAllowed()) return { ...fallback, status: "unavailable", lastError: "meta_backend_not_allowed" }
  try {
    const admin = createAdminClient()
    const dates = metaSpendDates(period, now)
    const { data, error } = await admin.from("meta_ads_daily_spend").select("date,ad_account_id,account_name,spend_amount,spend_currency,spend_gel,fx_rate_to_gel,fx_rate_date,fx_source,impressions,clicks,synced_at").eq("ad_account_id", META_AD_ACCOUNT_ID).gte("date", dates[0]).lte("date", dates[dates.length - 1]).limit(30)
    if (error || !data) return { ...fallback, status: "unavailable", lastError: "meta_storage_unavailable" }
    const summary = summarizeMetaSpend(data as MetaSpendRow[], period, now)
    const state = await admin.from("meta_ads_sync_state").select("last_error").eq("ad_account_id", META_AD_ACCOUNT_ID).maybeSingle()
    return { ...summary, lastError: state.error ? "meta_storage_unavailable" : state.data?.last_error ?? null }
  } catch { return { ...fallback, status: "unavailable", lastError: "meta_storage_unavailable" } }
}

export async function syncMetaSpend() {
  const status = metaSpendConfigurationStatus()
  if (status) throw new MetaSpendError(status)
  const admin = createAdminClient()
  const now = new Date()
  const dates = metaSpendDates("30", now)
  const runId = crypto.randomUUID()
  const claim = await admin.rpc("claim_meta_ads_spend_sync", { p_run_id: runId })
  if (claim.error) throw new MetaSpendError("meta_storage_unavailable")
  if (claim.data !== true) throw new MetaSpendError("meta_sync_busy")
  try {
    // Fetch the complete authoritative report before creating any zero-spend days or writes.
    const report = await fetchMetaDailySpend({ token: process.env.META_ADS_ACCESS_TOKEN!, version: process.env.META_ADS_GRAPH_API_VERSION!, appSecret: process.env.META_ADS_APP_SECRET }, dates)
    const existing = await admin.from("meta_ads_daily_spend").select("date,fx_rate_to_gel,fx_rate_date,fx_source").eq("ad_account_id", META_AD_ACCOUNT_ID).gte("date", dates[0]).lte("date", dates[29]).limit(30)
    if (existing.error) throw new MetaSpendError("meta_storage_unavailable")
    const rates = new Map<string, { rate: number; date: string; source: "NBG" } | null>()
    for (const row of existing.data ?? []) {
      if (row.fx_source === "NBG" && Number(row.fx_rate_to_gel) > 0 && row.fx_rate_date) rates.set(row.date, { rate: Number(row.fx_rate_to_gel), date: row.fx_rate_date, source: "NBG" })
    }
    // Bounded batches keep historical NBG requests within a server function's duration.
    const missing = dates.filter(date => !rates.has(date))
    for (let i = 0; i < missing.length; i += 5) {
      await Promise.all(missing.slice(i, i + 5).map(async date => { rates.set(date, await fetchNbgRate(date)) }))
    }
    const byDate = new Map(report.map(row => [row.date, row]))
    const rows = dates.map(date => {
      const insight = byDate.get(date)
      const fx = rates.get(date)
      return { date, spend_amount: insight?.spend ?? "0", fx_rate_to_gel: fx?.rate ?? null, fx_rate_date: fx?.date ?? null, fx_source: fx?.source ?? null, impressions: insight?.impressions ?? 0, clicks: insight?.clicks ?? 0 }
    })
    const saved = await admin.rpc("commit_meta_ads_spend_sync", { p_run_id: runId, p_reported_at: now.toISOString(), p_rows: rows })
    if (saved.error || saved.data !== true) throw new MetaSpendError("meta_storage_unavailable")
    return { accountId: META_AD_ACCOUNT_ID, accountName: META_AD_ACCOUNT_NAME, currency: "USD", syncedAt: now.toISOString(), days: rows.length, fxDays: rows.filter(row => row.fx_rate_to_gel !== null).length }
  } catch (error) {
    const code = error instanceof MetaSpendError ? error.code : "meta_sync_failed"
    try { await admin.rpc("fail_meta_ads_spend_sync", { p_run_id: runId, p_error: code }) } catch { /* Lease expires if storage is unavailable. */ }
    throw new MetaSpendError(code)
  }
}
