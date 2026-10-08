// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { META_AD_ACCOUNT_ID, META_AD_ACCOUNT_NAME, metaAcquisitionMetrics, metaSpendDates, summarizeMetaSpend, type MetaSpendRow } from "@/lib/growth/meta-spend"
import { fetchMetaDailySpend, fetchNbgRate, parseNbgRate } from "@/lib/growth/meta-spend-source"
import type { GrowthSummary } from "@/lib/growth/dashboard"

const now = new Date("2026-10-07T12:00:00Z")
const dates = metaSpendDates("30", now)
const rows = (): MetaSpendRow[] => dates.map(date => ({ date, ad_account_id: META_AD_ACCOUNT_ID, account_name: META_AD_ACCOUNT_NAME, spend_amount: "2.00", spend_currency: "USD", spend_gel: "5.00", fx_rate_to_gel: "2.5", fx_rate_date: date, fx_source: "NBG", impressions: 200, clicks: 10, synced_at: now.toISOString() }))
const growth = { counts: { registrations: 5, published_listings: 10, paying_sellers: 2, revenue: 100 }, new_sellers: 4 } as GrowthSummary
const account = { account_id: META_AD_ACCOUNT_ID, name: META_AD_ACCOUNT_NAME, currency: "USD", timezone_name: "Asia/Tbilisi" }
const insight = { account_id: META_AD_ACCOUNT_ID, account_currency: "USD", date_start: dates[29], date_stop: dates[29], spend: "1.25", impressions: "10", clicks: "1" }
const config = { token: "unit-test-only-token", version: "v99.0" }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("Meta spend calendar and financial definitions", () => {
  it("uses Tbilisi midnight, including UTC rollover and month/year boundaries", () => {
    expect(metaSpendDates("today", new Date("2026-10-07T19:59:59Z"))).toEqual(["2026-10-07"])
    expect(metaSpendDates("today", new Date("2026-10-07T20:00:00Z"))).toEqual(["2026-10-08"])
    expect(metaSpendDates("7", new Date("2026-01-01T21:00:00Z"))).toEqual(["2025-12-27", "2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"])
    expect(dates).toHaveLength(30)
    expect(dates[0]).toBe("2026-09-08")
  })
  it.each([["today", 2, 5], ["7", 14, 35], ["30", 60, 150]])("aggregates %s using exactly the selected calendar days", (period, usd, gel) => {
    expect(summarizeMetaSpend(rows(), String(period), now)).toMatchObject({ status: "ready", spendUsd: usd, spendGel: gel })
  })
  it("never turns missing, duplicate or foreign-account data into available spend", () => {
    expect(summarizeMetaSpend([], "7", now).status).toBe("not_connected")
    expect(summarizeMetaSpend(rows().slice(0, 29), "7", now)).toMatchObject({ status: "incomplete", spendUsd: null })
    expect(summarizeMetaSpend([...rows(), rows()[29]], "7", now).status).toBe("incomplete")
    expect(summarizeMetaSpend(rows().map(row => ({ ...row, ad_account_id: "71020156" })), "7", now).status).toBe("unavailable")
  })
  it("withholds all GEL metrics if even one day's official FX is unavailable", () => {
    const input = rows(); input[29].spend_gel = null; input[29].fx_rate_to_gel = null
    const spend = summarizeMetaSpend(input, "7", now)
    expect(spend).toMatchObject({ spendUsd: 14, spendGel: null, fxStatus: "unavailable" })
    expect(Object.values(metaAcquisitionMetrics(spend, growth))).toEqual([null, null, null, null, null])
    expect(spend.dailySpend?.every(point => point.gel === null)).toBe(true)
  })
  it("provides chart points in calendar order for only the selected period", () => {
    const spend = summarizeMetaSpend(rows().reverse(), "7", now)
    expect(spend.dailySpend?.map(point => point.date)).toEqual(metaSpendDates("7", now))
    expect(spend.dailySpend?.[0]).toEqual({ date: "2026-10-01", usd: 2, gel: 5 })
    expect(summarizeMetaSpend(rows().slice(0, 29), "7", now).dailySpend).toBeUndefined()
  })
  it("computes all costs and account-level blended ROAS from confirmed Growth counts", () => {
    expect(metaAcquisitionMetrics(summarizeMetaSpend(rows(), "today", now), growth)).toEqual({ registration: 1, listing: 0.5, newSeller: 1.25, payingSeller: 2.5, roas: 20 })
  })
  it("keeps reported zero spend distinct from unavailable and handles zero denominators", () => {
    const zeroRows = rows().map(row => ({ ...row, spend_amount: "0", spend_gel: "0" }))
    const zeroSpend = summarizeMetaSpend(zeroRows, "today", now)
    expect(zeroSpend).toMatchObject({ status: "ready", spendUsd: 0, spendGel: 0 })
    expect(metaAcquisitionMetrics(zeroSpend, growth)).toMatchObject({ registration: 0, roas: null })
    const zeroGrowth = { ...growth, counts: { ...growth.counts, registrations: 0, published_listings: 0, paying_sellers: 0 }, new_sellers: 0 }
    expect(metaAcquisitionMetrics(zeroSpend, zeroGrowth)).toEqual({ registration: null, listing: null, newSeller: null, payingSeller: null, roas: null })
    expect(metaAcquisitionMetrics(zeroSpend, null).roas).toBeNull()
  })
  it("marks old successful snapshots stale without inventing a new sync timestamp", () => {
    expect(summarizeMetaSpend(rows().map(row => ({ ...row, synced_at: "2026-10-06T00:00:00Z" })), "7", now)).toMatchObject({ stale: true, syncedAt: "2026-10-06T00:00:00Z" })
  })
  it("retains historical spend but withholds current cost ratios after a failed or stale sync", () => {
    const spend = summarizeMetaSpend(rows(), "7", now)
    for (const state of [{ ...spend, lastError: "meta_authorization_failed" }, { ...spend, stale: true }]) {
      expect(state.spendUsd).toBe(14)
      expect(Object.values(metaAcquisitionMetrics(state, growth))).toEqual([null, null, null, null, null])
    }
  })
})

describe("Meta account isolation and complete source reports", () => {
  it("queries only the approved account, validates metadata and uses header credentials", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(account)).mockResolvedValueOnce(json({ data: [insight] }))
    expect(await fetchMetaDailySpend(config, dates, fetcher)).toEqual([{ date: dates[29], spend: "1.25", impressions: 10, clicks: 1 }])
    for (const [url, options] of fetcher.mock.calls) {
      expect(url).toContain(`act_${META_AD_ACCOUNT_ID}`)
      expect(url).not.toContain(config.token); expect(url).not.toContain("71020156")
      expect(options.headers.Authorization).toBe(`Bearer ${config.token}`)
      expect(options.redirect).toBe("error")
    }
    const url = new URL(fetcher.mock.calls[1][0])
    expect(url.searchParams.get("time_increment")).toBe("1")
    expect(url.searchParams.get("level")).toBe("account")
    expect(JSON.parse(url.searchParams.get("time_range")!)).toEqual({ since: dates[0], until: dates[29] })
  })
  it.each([{ account_id: "71020156" }, { currency: "GEL" }, { timezone_name: "UTC" }, { name: "Wrong account" }])("rejects metadata mismatch %j before importing insights", async mismatch => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ ...account, ...mismatch }))
    await expect(fetchMetaDailySpend(config, dates, fetcher)).rejects.toThrow("meta_account_mismatch")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([
    [{ code: 190, error_subcode: 463 }, "meta_token_expired"],
    [{ code: 190, error_subcode: 467 }, "meta_token_invalid"],
    [{ code: 200 }, "meta_permission_denied"],
    [{ code: 10 }, "meta_permission_denied"],
    [{ code: 100, error_subcode: 33 }, "meta_account_access_denied"],
  ])("classifies access failure %j without disclosing the provider payload", async (error, reason) => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { ...error, message: "private token detail" } }, 400))
    await expect(fetchMetaDailySpend(config, dates, fetcher)).rejects.toMatchObject({ code: "meta_authorization_failed", reason, message: "meta_authorization_failed" })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("accepts a genuinely empty successful report, while API failure is not zero spend", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(account)).mockResolvedValueOnce(json({ data: [] }))
    expect(await fetchMetaDailySpend(config, dates, fetcher)).toEqual([])
    const denied = vi.fn().mockResolvedValue(json({ error: { code: 190, message: "private token detail" } }, 401))
    await expect(fetchMetaDailySpend(config, dates, denied)).rejects.toThrow("meta_authorization_failed")
  })
  it.each([{ account_id: "71020156" }, { account_currency: "GEL" }, { spend: "NaN" }, { spend: "-1" }, { spend: "0.0001" }, { date_start: "2020-01-01" }, { impressions: "1.5" }])("rejects malformed/foreign rows %j", async change => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(account)).mockResolvedValueOnce(json({ data: [{ ...insight, ...change }] }))
    await expect(fetchMetaDailySpend(config, dates, fetcher)).rejects.toThrow("meta_invalid_report")
  })
  it("rejects duplicate daily rows instead of double counting", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(account)).mockResolvedValueOnce(json({ data: [insight, insight] }))
    await expect(fetchMetaDailySpend(config, dates, fetcher)).rejects.toThrow("meta_invalid_report")
  })
  it("fully paginates with an opaque cursor and never follows next URLs", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(account)).mockResolvedValueOnce(json({ data: [insight], paging: { next: "https://untrusted.example/token", cursors: { after: "cursor-a" } } })).mockResolvedValueOnce(json({ data: [] }))
    expect(await fetchMetaDailySpend(config, dates, fetcher)).toHaveLength(1)
    expect(fetcher.mock.calls[2][0]).toContain("graph.facebook.com")
    expect(fetcher.mock.calls[2][0]).toContain("after=cursor-a")
  })
  it("does not accept a truncated report or follow a repeated paging cursor", async () => {
    const page = { data: [], paging: { next: "anything", cursors: { after: "repeat" } } }
    const fetcher = vi.fn().mockResolvedValueOnce(json(account)).mockResolvedValueOnce(json(page)).mockResolvedValueOnce(json(page))
    await expect(fetchMetaDailySpend(config, dates, fetcher)).rejects.toThrow("meta_incomplete_report")
  })
})

describe("NBG historical FX", () => {
  const body = [{ currencies: [{ code: "USD", quantity: 1, rate: 2.7345, validFromDate: "2026-10-07T00:00:00.000Z" }] }]
  it("reads the official dated rate and respects currency quantity", () => {
    expect(parseNbgRate(body, "2026-10-07")).toEqual({ rate: 2.7345, date: "2026-10-07", source: "NBG" })
    expect(parseNbgRate([{ currencies: [{ ...body[0].currencies[0], quantity: 10 }] }], "2026-10-07")?.rate).toBe(0.27345)
  })
  it("rejects future, stale, missing and invalid rates", () => {
    expect(parseNbgRate(body, "2026-10-06")).toBeNull()
    expect(parseNbgRate(body, "2026-10-15")).toBeNull()
    expect(parseNbgRate([], "2026-10-07")).toBeNull()
    expect(parseNbgRate([{ currencies: [{ ...body[0].currencies[0], rate: 0 }] }], "2026-10-07")).toBeNull()
  })
  it("requests a historical date and fails closed on source/network failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(body))
    expect(await fetchNbgRate("2026-10-07", fetcher)).not.toBeNull()
    expect(fetcher.mock.calls[0][0]).toBe("https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=2026-10-07")
    expect(await fetchNbgRate("2026-10-07", vi.fn().mockRejectedValue(new Error("network")))).toBeNull()
  })
})
