import "server-only"
import { createHmac } from "node:crypto"
import { META_AD_ACCOUNT_ID, META_AD_ACCOUNT_NAME, META_AD_ACCOUNT_TIMEZONE } from "./meta-spend"

export class MetaSpendError extends Error {
  constructor(public readonly code: string, public readonly reason?: "meta_token_expired" | "meta_token_invalid" | "meta_permission_denied" | "meta_account_access_denied") { super(code) }
}
type DailyInsight = { date: string; spend: string; impressions: number; clicks: number }
type MetaConfig = { token: string; version: string; appSecret?: string }
export type NbgRate = { rate: number; date: string; source: "NBG" }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value))
function count(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,15}$/.test(value) || !Number.isSafeInteger(Number(value))) throw new MetaSpendError("meta_invalid_report")
  return Number(value)
}

async function graph(config: MetaConfig, path: string, params: Record<string, string>, fetcher: typeof fetch) {
  const url = new URL(`https://graph.facebook.com/${config.version}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  if (config.appSecret) url.searchParams.set("appsecret_proof", createHmac("sha256", config.appSecret).update(config.token).digest("hex"))
  try {
    const response = await fetcher(url.toString(), { headers: { Authorization: `Bearer ${config.token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) })
    const body: unknown = await response.json()
    if (!response.ok || !isRecord(body) || body.error) {
      const error = isRecord(body) && isRecord(body.error) ? body.error : null
      if (error?.code === 190) throw new MetaSpendError("meta_authorization_failed", error.error_subcode === 463 ? "meta_token_expired" : "meta_token_invalid")
      if (error?.code === 10 || error?.code === 200) throw new MetaSpendError("meta_authorization_failed", "meta_permission_denied")
      if (error?.code === 100 && error.error_subcode === 33) throw new MetaSpendError("meta_authorization_failed", "meta_account_access_denied")
      throw new MetaSpendError(response.status === 401 || response.status === 403 || error?.code === 190 || error?.code === 200 ? "meta_authorization_failed" : "meta_api_unavailable")
    }
    return body
  } catch (error) {
    // Never propagate a provider payload, request URL, access token or fetch exception.
    if (error instanceof MetaSpendError) throw error
    throw new MetaSpendError("meta_api_unavailable")
  }
}

export async function fetchMetaDailySpend(config: MetaConfig, dates: string[], fetcher: typeof fetch = fetch): Promise<DailyInsight[]> {
  if (!config.token || !/^v\d+\.0$/.test(config.version) || dates.length !== 30) throw new MetaSpendError("meta_credentials_missing")
  const account = await graph(config, `act_${META_AD_ACCOUNT_ID}`, { fields: "account_id,name,currency,timezone_name" }, fetcher)
  if (account.account_id !== META_AD_ACCOUNT_ID || account.name !== META_AD_ACCOUNT_NAME || account.currency !== "USD" || account.timezone_name !== META_AD_ACCOUNT_TIMEZONE) throw new MetaSpendError("meta_account_mismatch")
  const params = { level: "account", time_increment: "1", time_range: JSON.stringify({ since: dates[0], until: dates[dates.length - 1] }), fields: "account_id,account_currency,date_start,date_stop,spend,impressions,clicks", limit: "100" }
  const rows: DailyInsight[] = []
  const seen = new Set<string>()
  const cursors = new Set<string>()
  let cursor: string | undefined
  for (let page = 0; page < 3; page++) {
    const body = await graph(config, `act_${META_AD_ACCOUNT_ID}/insights`, { ...params, ...(cursor ? { after: cursor } : {}) }, fetcher)
    if (!Array.isArray(body.data) || body.data.length > 30) throw new MetaSpendError("meta_invalid_report")
    for (const row of body.data) {
      if (!isRecord(row) || row.account_id !== META_AD_ACCOUNT_ID || row.account_currency !== "USD" || typeof row.date_start !== "string" || row.date_stop !== row.date_start || !dates.includes(row.date_start) || seen.has(row.date_start) || typeof row.spend !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(row.spend)) throw new MetaSpendError("meta_invalid_report")
      seen.add(row.date_start)
      rows.push({ date: row.date_start, spend: row.spend, impressions: count(row.impressions), clicks: count(row.clicks) })
    }
    if (body.paging !== undefined && !isRecord(body.paging)) throw new MetaSpendError("meta_invalid_report")
    const paging = isRecord(body.paging) ? body.paging : null
    if (!paging?.next) return rows
    const after = isRecord(paging.cursors) ? paging.cursors.after : null
    if (typeof after !== "string" || !after || after.length > 1000 || cursors.has(after)) throw new MetaSpendError("meta_incomplete_report")
    cursors.add(after)
    cursor = after
    // Rebuild the fixed account URL with an opaque cursor. Never follow provider next URLs.
  }
  throw new MetaSpendError("meta_incomplete_report")
}

export function parseNbgRate(body: unknown, requestedDate: string): NbgRate | null {
  if (!Array.isArray(body) || body.length !== 1 || !isRecord(body[0]) || !Array.isArray(body[0].currencies)) return null
  const usd = body[0].currencies.find((row: unknown) => isRecord(row) && row.code === "USD")
  if (!isRecord(usd) || typeof usd.rate !== "number" || typeof usd.quantity !== "number" || usd.quantity <= 0 || !Number.isFinite(usd.rate) || usd.rate <= 0 || typeof usd.validFromDate !== "string") return null
  const date = usd.validFromDate.slice(0, 10)
  const age = Date.parse(requestedDate) - Date.parse(date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(age) || age < 0 || age > 7 * 86400_000) return null
  return { rate: usd.rate / usd.quantity, date, source: "NBG" }
}

export async function fetchNbgRate(date: string, fetcher: typeof fetch = fetch): Promise<NbgRate | null> {
  try {
    const response = await fetcher(`https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=${date}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) })
    return response.ok ? parseNbgRate(await response.json(), date) : null
  } catch { return null }
}
