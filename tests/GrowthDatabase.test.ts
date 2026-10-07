// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { beforeAll, afterAll, describe, it, expect } from "vitest"
let db: PGlite
const seller = "11111111-1111-4111-8111-111111111111"
const anon = "22222222-2222-4222-8222-222222222222"
const session = "33333333-3333-4333-8333-333333333333"
const listing = "44444444-4444-4444-8444-444444444444"
const order = "55555555-5555-4555-8555-555555555555"
const banner = "66666666-6666-4666-8666-666666666666"
async function count(name: string) { return Number((await db.query<{ n: number }>("select count(*) n from growth_events where event_name=$1", [name])).rows[0].n) }
async function rpc(fn: string, event: Record<string, unknown>) { return db.query(`select public.${fn}($1::jsonb) result`, [JSON.stringify(event)]) }
const context = () => ({ user_id: seller, anonymous_id: anon, session_id: session, first_touch: { utm_source: "meta", utm_campaign: "seller_oct26" }, last_touch: { utm_source: "meta" }, marketing_consent: true, consent_updated_at: Date.now(), expires_at: Date.now() + 86400_000 })
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz, is_anonymous boolean default false);
    create table profiles(id uuid primary key, is_admin boolean default false);
    create table listings(id uuid primary key,seller_id uuid,status text,published_at timestamptz);
    create table listing_images(id uuid primary key,listing_id uuid);
    create table listing_boost_orders(id uuid primary key,seller_id uuid,listing_id uuid,status text,paid_at timestamptz,payment_provider text,provider_status text,provider_payment_id text,currency text,amount numeric,product_id text,placement_snapshot text);
    create table ad_orders(id uuid primary key,user_id uuid,status text,paid_at timestamptz,payment_provider text,provider_status text,provider_payment_id text,currency text,amount numeric,product_id text);
    create table flitt_payment_attempts(boost_order_id uuid,ad_order_id uuid,user_id uuid,purpose text,mode text,status text,provider_status text,response_status text,provider_verified_at timestamptz,provider_verification_source text,provider_payment_id text,currency text,amount integer);
    create table favorites(id uuid,created_at timestamptz default now());
    create table chat_threads(id uuid,chat_type text,created_at timestamptz default now());
  `)
  await db.exec(readFileSync("supabase/migrations/20261007090317_growth_tracking_v1.sql", "utf8"))
}, 30000)
afterAll(async () => db?.close())
describe.sequential("Growth authoritative SQL and isolation", () => {
  it("counts confirmed Google registration once, never unconfirmed email signup", async () => {
    await db.exec(`insert into auth.users(id) values('${seller}'); insert into profiles values('${seller}',true);`)
    expect(await count("registration_completed")).toBe(0)
    await db.exec(`update auth.users set email_confirmed_at=now() where id='${seller}';`)
    expect(await count("registration_completed")).toBe(1)
    await db.exec(`update auth.users set email_confirmed_at=now() where id='${seller}';`)
    expect(await count("registration_completed")).toBe(1)
    await db.exec(`insert into auth.users(id,email_confirmed_at) values('${anon}',now());`)
    expect(await count("registration_completed")).toBe(2)
  })
  it("never counts anonymous auth identities as registration", async () => {
    await db.exec(`insert into auth.users(id,email_confirmed_at,is_anonymous) values('${session}',now(),true);`)
    expect(await count("registration_completed")).toBe(2)
  })
  it("rejects browser forgery of successful registration or payment", async () => {
    await expect(rpc("ingest_growth_browser_event", { ...context(), event_name: "boost_purchase_completed", event_id: "fake" })).rejects.toThrow("Untrusted event")
    await expect(rpc("ingest_growth_browser_event", { ...context(), event_name: "registration_completed", event_id: "fake" })).rejects.toThrow("Untrusted event")
  })
  it("records page views idempotently and preserves verified registration attribution", async () => {
    const event = { ...context(), event_name: "page_view", event_id: "page-one", path: "/sell", route_group: "sell", device_class: "mobile" }
    await rpc("ingest_growth_browser_event", event); await rpc("ingest_growth_browser_event", event)
    expect(await count("page_view")).toBe(1)
    const row = (await db.query<{ first_touch: { utm_source: string } }>("select first_touch from growth_events where event_id=$1", [`registration_completed:${seller}`])).rows[0]
    expect(row.first_touch.utm_source).toBe("meta")
  })
  it("counts actual starts once per attempt and counts failed publish separately", async () => {
    const event = { ...context(), event_name: "listing_started", event_id: `listing_started:${listing}`, path: "/dashboard/listings/new" }
    await rpc("ingest_growth_browser_event", event); await rpc("ingest_growth_browser_event", event)
    await rpc("ingest_growth_browser_event", { ...context(), event_name: "listing_publish_failed", event_id: "failed-one" })
    expect(await count("listing_started")).toBe(1); expect(await count("listing_published")).toBe(0)
  })
  it("does not publish drafts or partially saved listings, then publishes exactly once", async () => {
    await db.exec(`insert into listings values('${listing}','${seller}','draft',null);`)
    const event = { ...context(), event_name: "listing_published", event_id: `listing_published:${listing}`, listing_id: listing }
    await rpc("record_growth_outcome", event); expect(await count("listing_published")).toBe(0)
    await db.exec(`update listings set status='active',published_at=now() where id='${listing}';`)
    await rpc("record_growth_outcome", event); expect(await count("listing_published")).toBe(0)
    await db.exec(`insert into listing_images values('${listing}','${listing}');`)
    await rpc("record_growth_outcome", event); await rpc("record_growth_outcome", event)
    expect(await count("listing_published")).toBe(1)
  })
  it("rejects a spoofed owner and deduplicates retried edit completion", async () => {
    await rpc("record_growth_outcome", { ...context(), user_id: anon, event_name: "listing_edit_completed", event_id: "edit-spoof", listing_id: listing })
    const event = { ...context(), event_name: "listing_edit_completed", event_id: `edit:${listing}:request-one`, listing_id: listing }
    await rpc("record_growth_outcome", event); await rpc("record_growth_outcome", event)
    expect(await count("listing_edit_completed")).toBe(1)
  })
  it.each(["Created", "Processing", "Failed", "Expired", "Returned"])("never books a TBC %s payment as revenue", async status => {
    await db.exec(`insert into listing_boost_orders values('${order}','${seller}','${listing}','pending_payment',null,'tbc_checkout','${status}','tbc-one','GEL',9.90,'vip','vip') on conflict(id) do update set provider_status='${status}';`)
    expect(await count("boost_purchase_completed")).toBe(0)
  })
  it("deduplicates checkout and captures only verified successful TBC state", async () => {
    const event = { ...context(), event_name: "boost_checkout_started", event_id: `boost_checkout_started:boost:${order}`, order_id: order, product_type: "boost" }
    await rpc("record_growth_outcome", event); await rpc("record_growth_outcome", event)
    expect(await count("boost_checkout_started")).toBe(1)
    await db.exec(`update listing_boost_orders set paid_at=now(),provider_status='Succeeded',status='active' where id='${order}';`)
    expect(await count("boost_purchase_completed")).toBe(1)
    await db.exec(`update listing_boost_orders set provider_status='Succeeded' where id='${order}';`)
    expect(await count("boost_purchase_completed")).toBe(1)
    expect((await db.query<{ amount: string }>("select amount from growth_events where event_name='boost_purchase_completed'")).rows[0].amount).toBe("9.90")
  })
  it("rejects sandbox and unverified Flitt purchases, then captures live banner once", async () => {
    await db.exec(`insert into flitt_payment_attempts values(null,'${banner}','${seller}','ad_order','test','approved','approved','success',null,null,'flitt-one','GEL',2500);
    insert into ad_orders values('${banner}','${seller}','paid_pending_review',now(),'flitt','approved','flitt-one','GEL',25,'banner-week');`)
    expect(await count("boost_purchase_completed")).toBe(1)
    await db.exec(`update flitt_payment_attempts set mode='live'; update ad_orders set provider_status='approved';`)
    expect(await count("boost_purchase_completed")).toBe(1)
    await db.exec(`update flitt_payment_attempts set provider_verified_at=now(),provider_verification_source='status_api'; update ad_orders set provider_status='approved'; update ad_orders set status='active';`)
    expect(await count("boost_purchase_completed")).toBe(2)
  })
  it("protects every telemetry table and RPC from anon/authenticated roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`)
      for (const table of ["growth_events", "growth_user_context", "growth_order_context", "growth_conversion_keys", "growth_consent_state"]) await expect(db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/)
      await expect(db.query("select public.ingest_growth_browser_event('{}')")).rejects.toThrow(/permission denied/)
      await expect(db.query("select public.get_growth_summary(null,now()-interval '7 days',now())")).rejects.toThrow(/permission denied/)
      await db.exec("reset role")
    }
  })
  it("enforces admin access and returns authoritative revenue without fabricated spend", async () => {
    await expect(db.query("select get_growth_summary($1,now()-interval '7 days',now())", [anon])).rejects.toThrow("Admin required")
    const result = (await db.query<{ result: { counts: { revenue: number; purchases: number }; funnel: number[] } }>("select get_growth_summary($1,now()-interval '7 days',now()+interval '1 second') result", [seller])).rows[0].result
    expect(Number(result.counts.revenue)).toBeCloseTo(34.9); expect(result.counts.purchases).toBe(2)
    expect(result.funnel.every((n, i, all) => !i || n <= all[i - 1])).toBe(true)
    expect(result).not.toHaveProperty("spend")
  })
  it("withdraws anonymous and user marketing permission and refuses stale queued ingestion", async () => {
    const old = context()
    await db.query("select revoke_growth_consent($1,$2,$3)", [seller, anon, Date.now()+1000])
    await rpc("ingest_growth_browser_event", { ...old, event_name: "page_view", event_id: "stale" })
    expect((await db.query("select * from growth_events where event_id='stale'")).rows).toHaveLength(0)
    expect((await db.query("select * from claim_growth_meta_events(null,20)")).rows).toHaveLength(0)
  })
  it("retention keeps a minimal purchase key so late callbacks cannot recreate revenue", async () => {
    await db.exec(`update growth_events set occurred_at=now()-interval '400 days' where event_id='boost_purchase_completed:boost:${order}';`)
    await db.query("select prune_growth_events(5000)")
    await db.exec(`update listing_boost_orders set provider_status='Succeeded' where id='${order}';`)
    expect((await db.query("select * from growth_events where event_id=$1", [`boost_purchase_completed:boost:${order}`])).rows).toHaveLength(0)
    expect((await db.query("select * from growth_conversion_keys where event_id=$1", [`boost_purchase_completed:boost:${order}`])).rows).toHaveLength(1)
  })
})
