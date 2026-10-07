// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { metaSpendDates } from "@/lib/growth/meta-spend"
let db: PGlite
const run = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const report = () => metaSpendDates("30").map(date => ({ date, spend_amount: "1.25", fx_rate_to_gel: 2.5, fx_rate_date: date, fx_source: "NBG", impressions: 10, clicks: 1 }))
async function commit(rows = report(), id = run) { return db.query("select commit_meta_ads_spend_sync($1,now(),$2::jsonb) result", [id, JSON.stringify(rows)]) }
beforeAll(async () => {
  db = new PGlite()
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;")
  await db.exec(readFileSync("supabase/migrations/20261007123857_meta_ads_daily_spend.sql", "utf8"))
}, 30000)
afterAll(async () => db?.close())
describe.sequential("Meta service-only persistence", () => {
  it("blocks client access and RPC execution, with RLS on both tables", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`)
      for (const table of ["meta_ads_daily_spend", "meta_ads_sync_state"]) await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/)
      await expect(db.query("select claim_meta_ads_spend_sync($1)", [run])).rejects.toThrow(/permission denied/)
      await expect(commit()).rejects.toThrow(/permission denied/)
      await expect(db.query("select fail_meta_ads_spend_sync($1,'meta_sync_failed')", [run])).rejects.toThrow(/permission denied/)
      await db.exec("reset role")
    }
    expect((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname in ('meta_ads_daily_spend','meta_ads_sync_state')")).rows.every(row => row.relrowsecurity)).toBe(true)
  })
  it("claims one leased run, rejects a concurrent run and stale commits", async () => {
    await db.exec("set role service_role")
    expect((await db.query<{ result: boolean }>("select claim_meta_ads_spend_sync($1) result", [run])).rows[0].result).toBe(true)
    expect((await db.query<{ result: boolean }>("select claim_meta_ads_spend_sync($1) result", [other])).rows[0].result).toBe(false)
    await expect(commit(report(), other)).rejects.toThrow(/Sync lease unavailable/)
    await db.exec("reset role")
  })
  it("rejects missing/duplicate date coverage atomically", async () => {
    await expect(commit(report().slice(1))).rejects.toThrow(/Invalid report/)
    const duplicate = report(); duplicate[0] = duplicate[1]
    await expect(commit(duplicate)).rejects.toThrow(/Incomplete report/)
    expect((await db.query("select * from meta_ads_daily_spend")).rows).toHaveLength(0)
  })
  it("commits an exact 30-day snapshot via the service role", async () => {
    await db.exec("set role service_role")
    expect((await commit()).rows[0]).toMatchObject({ result: true })
    await db.exec("reset role")
    expect((await db.query("select * from meta_ads_daily_spend")).rows).toHaveLength(30)
    expect((await db.query<{ sum: string }>("select sum(spend_amount) from meta_ads_daily_spend")).rows[0].sum).toBe("37.500000")
  })
  it("upserts corrected source spend without duplicates and freezes historical FX", async () => {
    await db.exec("update meta_ads_sync_state set last_started_at=null")
    await db.query("select claim_meta_ads_spend_sync($1)", [other])
    await commit(report().map(row => ({ ...row, spend_amount: "2", fx_rate_to_gel: 3 })), other)
    const rows = (await db.query<{ fx_rate_to_gel: string; spend_gel: string }>("select * from meta_ads_daily_spend")).rows
    expect(rows).toHaveLength(30)
    expect(rows.every(row => Number(row.fx_rate_to_gel) === 2.5 && Number(row.spend_gel) === 5)).toBe(true)
    await expect(commit(report(), other)).rejects.toThrow(/Sync lease unavailable/)
  })
  it("rejects the old account, campaign mixing and forged FX conversions", async () => {
    await expect(db.exec("update meta_ads_daily_spend set ad_account_id='71020156'")).rejects.toThrow(/check constraint/)
    await expect(db.exec("update meta_ads_daily_spend set campaign_id='fake-campaign'")).rejects.toThrow(/check constraint/)
    await expect(db.exec("update meta_ads_daily_spend set spend_gel=99")).rejects.toThrow(/meta_ads_fx_complete/)
  })
  it("accepts missing FX as NULL and later fills it once", async () => {
    await db.exec("update meta_ads_daily_spend set spend_gel=null,fx_rate_to_gel=null,fx_rate_date=null,fx_source=null; update meta_ads_sync_state set last_started_at=null")
    await db.query("select claim_meta_ads_spend_sync($1)", [run]); await commit()
    expect((await db.query("select * from meta_ads_daily_spend where spend_gel is null")).rows).toHaveLength(0)
  })
  it("preserves a genuine zero source report without fabricating revenue", async () => {
    await db.exec("update meta_ads_sync_state set last_started_at=null")
    await db.query("select claim_meta_ads_spend_sync($1)", [run]); await commit(report().map(row => ({ ...row, spend_amount: "0", impressions: 0, clicks: 0 })))
    expect(Number((await db.query<{ total: string }>("select sum(spend_amount) total from meta_ads_daily_spend")).rows[0].total)).toBe(0)
  })
})
