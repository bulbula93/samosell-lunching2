// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

let db: PGlite
const listing="11111111-1111-4111-8111-111111111111"
const other="22222222-2222-4222-8222-222222222222"

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.listings (id uuid primary key,title text,slug text,public_id text,status text);
    create table public.catalog_engagement_events(
      event_key text primary key,listing_id uuid,event_kind text,page_hash text,
      position smallint,occurred_at timestamptz
    );
    create table public.listing_view_daily(
      listing_id uuid,viewer_hash text,viewed_on date,created_at timestamptz
    );
    create table public.listing_view_totals(listing_id uuid,measured_views bigint);
    insert into public.listings values
    ('${listing}','ნივთი A','item-a','SS-A','active'),
    ('${other}','ნივთი B','item-b','SS-B','active');
    insert into public.catalog_engagement_events values
    ('a','${listing}','impression','a',1,'2026-10-12T08:01:00Z'),
    ('b','${listing}','impression','a',1,'2026-10-12T08:02:00Z'),
    ('c','${listing}','click','a',1,'2026-10-12T08:03:00Z');
    insert into public.listing_view_daily values
    ('${listing}','x','2026-10-12','2026-10-12T08:04:00Z');
    insert into public.listing_view_totals values
    ('${listing}',7);
  `)
  await db.exec(readFileSync("supabase/migrations/20261012161000_buyer_liquidity_dashboard_rpc.sql","utf8"))
}, 30000)
afterAll(async()=>{await db?.close()})

describe("Buyer liquidity admin summary SQL",()=>{
  it("separates bounded event metrics from all-time measured totals",async()=>{
    const r=await db.query<{snapshot:Record<string,unknown>}>(`
      select public.get_buyer_liquidity_snapshot('2026-10-12T00:00:00Z','2026-10-13T00:00:00Z') as snapshot
    `)
    const summary=r.rows[0].snapshot
    expect(summary.active_listings).toBe(2)
    expect(summary.impressions).toBe(2)
    expect(summary.clicks).toBe(1)
    expect(summary.detail_views).toBe(1)
    expect(summary.lifetime_measured_views).toBe(7)
    expect(summary.listings_with_impressions).toBe(1)
    expect(summary.listings_with_views).toBe(1)
    expect((summary.top_listings as Array<{title:string,impressions:number}>)[0]).toMatchObject({title:"ნივთი A",impressions:2})
  })
  it("returns empty period without inventing activity",async()=>{
    const r=await db.query<{snapshot:Record<string,unknown>}>(`
      select public.get_buyer_liquidity_snapshot('2026-10-20T00:00:00Z','2026-10-21T00:00:00Z') as snapshot
    `)
    expect(r.rows[0].snapshot.impressions).toBe(0)
    expect(r.rows[0].snapshot.clicks).toBe(0)
    expect(r.rows[0].snapshot.detail_views).toBe(0)
    expect(r.rows[0].snapshot.active_listings).toBe(2)
  })
  it("retains historical period events after the viewed listing becomes archived",async()=>{
    await db.query("update public.listings set status='archived' where id=$1",[listing])
    try {
      const r=await db.query<{snapshot:Record<string,unknown>}>(`
        select public.get_buyer_liquidity_snapshot('2026-10-12T00:00:00Z','2026-10-13T00:00:00Z') as snapshot
      `)
      const summary=r.rows[0].snapshot
      expect(summary.active_listings).toBe(1)
      expect(summary.impressions).toBe(2)
      expect(summary.clicks).toBe(1)
      expect(summary.detail_views).toBe(1)
    } finally {
      await db.query("update public.listings set status='active' where id=$1",[listing])
    }
  })
  it("denies direct API roles",async()=>{
    const r=await db.query<{anon:boolean,auth:boolean,service:boolean}>(`
      select
      has_function_privilege('anon','public.get_buyer_liquidity_snapshot(timestamptz,timestamptz)','execute') as anon,
      has_function_privilege('authenticated','public.get_buyer_liquidity_snapshot(timestamptz,timestamptz)','execute') as auth,
      has_function_privilege('service_role','public.get_buyer_liquidity_snapshot(timestamptz,timestamptz)','execute') as service
    `)
    expect(r.rows[0]).toEqual({anon:false,auth:false,service:true})
  })
})

describe("Buyer liquidity operational checks",()=>{
  it("does not cache a fake empty home when both catalog queries fail",()=>{
    const home = readFileSync("lib/home-page.ts","utf8")
    const page = readFileSync("app/page.tsx","utf8")
    const content = readFileSync("components/home/HomePageContent.tsx","utf8")
    expect(home).toContain("home_public_data_retry")
    expect(home).toContain('select(HOME_LISTING_SELECT, { count: "exact" })')
    expect(home).toContain('throw new Error(`home_public_data_unavailable:')
    expect(page).toContain("Promise.all(")
    expect(page).not.toContain("Promise.allSettled")
    expect(page).not.toContain('dynamic = "force-dynamic"')
    expect(content).toContain("!catalogUnavailable&&data.latestItems.length===0")
  })
  it("registers a daily retention task and retains aggregate view totals",()=>{
    const migration=readFileSync("supabase/migrations/20261012160000_schedule_buyer_liquidity_retention.sql","utf8")
    const prune=readFileSync("supabase/migrations/20261012130000_catalog_engagement.sql","utf8")
    expect(migration).toContain("samosell-buyer-liquidity-retention")
    expect(migration).toContain("17 3 * * *")
    expect(prune).toContain("interval '35 days'")
    expect(prune).toContain("interval '2 days'")
    expect(prune).not.toContain("delete from public.listing_view_totals")
  })
})
