// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

let db: PGlite
const seller = "11111111-1111-4111-8111-111111111111"
const listing = "22222222-2222-4222-8222-222222222222"

function functionSql(path: string, start: string, end: string) {
  const sql = readFileSync(path, "utf8")
  return sql.slice(sql.indexOf(start), sql.indexOf(end, sql.indexOf(start)))
}

async function listingState() {
  return (await db.query<{
    vip_until: string | null
    promoted_until: string | null
    featured_until: string | null
  }>(`select vip_until, promoted_until, featured_until from listings where id = '${listing}'`)).rows[0]
}

async function addActiveOrder(id: string, product: string, endsAt: string, paymentId: string) {
  await db.exec(`
    insert into listing_boost_orders
      (id,listing_id,seller_id,product_id,status,starts_at,ends_at,payment_provider,payment_method,currency,amount,provider_payment_id,provider_status,paid_at)
    values
      ('${id}','${listing}','${seller}','${product}','active',now(),'${endsAt}','flitt','flitt','GEL',9.90,'${paymentId}','approved',now());
  `)
}

async function addReversedAttempt(orderId: string, paymentId: string) {
  await db.exec(`
    insert into flitt_payment_attempts
      (boost_order_id,purpose,status,provider_status,response_status,provider_payment_id,user_id,currency,amount,merchant_id)
    values
      ('${orderId}','boost_order','reversed','reversed','success','${paymentId}','${seller}','GEL',990,'424242');
  `)
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table profiles(id uuid primary key, is_admin boolean default false);
    create table listings(
      id uuid primary key, seller_id uuid not null, is_vip boolean default false,
      vip_until timestamptz, promoted_until timestamptz, featured_until timestamptz,
      featured_slot integer, home_banner_until timestamptz, home_banner_slot integer
    );
    create table listing_boost_products(id text primary key, placement text not null, duration_days integer not null);
    create table listing_boost_orders(
      id uuid primary key, listing_id uuid not null, seller_id uuid not null, product_id text not null,
      status text not null, starts_at timestamptz, ends_at timestamptz, payment_provider text,
      payment_method text, currency text, amount numeric, provider_payment_id text, provider_status text,
      provider_result_code text, paid_at timestamptz, last_payment_sync_at timestamptz,
      failure_reason text, approved_at timestamptz, reviewed_by uuid, placement_slot integer,
      cancelled_at timestamptz
    );
    create table flitt_payment_attempts(
      boost_order_id uuid, purpose text, status text, provider_status text, response_status text,
      provider_payment_id text, provider_verified_at timestamptz, provider_verification_source text,
      user_id uuid, currency text, amount integer, merchant_id text
    );
    create table listing_boost_order_events(
      id bigint generated always as identity primary key, order_id uuid, seller_id uuid,
      source text, event_type text, provider_status text, provider_result_code text,
      message text, payload jsonb, event_key text unique, created_at timestamptz default now()
    );
    insert into profiles(id) values ('${seller}');
    insert into listings(id,seller_id) values ('${listing}','${seller}');
    insert into listing_boost_products(id,placement,duration_days) values
      ('vip','vip',7),('top','promoted',7),('combo','combo',7);

    create or replace function private.reconcile_listing_boost_state(p_listing_id uuid)
    returns void language plpgsql security definer set search_path = '' as $$
    declare v_vip timestamptz; v_top timestamptz; v_featured timestamptz;
    begin
      select
        max(o.ends_at) filter (where p.placement in ('vip','combo')),
        max(o.ends_at) filter (where p.placement in ('promoted','combo')),
        max(o.ends_at) filter (where p.placement in ('featured_home','combo'))
      into v_vip,v_top,v_featured
      from public.listing_boost_orders o join public.listing_boost_products p on p.id=o.product_id
      where o.listing_id=p_listing_id and o.status='active' and o.ends_at>now();
      update public.listings set is_vip=v_vip is not null, vip_until=v_vip,
        promoted_until=v_top, featured_until=v_featured,
        featured_slot=case when v_featured is null then null else coalesce(featured_slot,1) end
      where id=p_listing_id;
    end $$;
  `)

  await db.exec(functionSql(
    "supabase/migrations/20260914123117_bind_flitt_to_boost_orders.sql",
    "create or replace function public.activate_listing_boost_order(",
    "create or replace function public.finalize_flitt_boost_payment(",
  ))
  await db.exec(functionSql(
    "supabase/migrations/20260914160354_harden_flitt_status_verification.sql",
    "create or replace function public.finalize_flitt_boost_payment(",
    "revoke all on function public.finalize_flitt_boost_payment",
  ))
  await db.exec(readFileSync("supabase/migrations/20260915090335_reconcile_reversed_flitt_boosts.sql", "utf8"))
})

afterAll(async () => db.close())

describe("Flitt boost database invariants", () => {
  it.each([
    ["VIP", "vip", "vip_until", "30000000-0000-4000-8000-000000000001"],
    ["TOP", "top", "promoted_until", "30000000-0000-4000-8000-000000000002"],
    ["VIP MAX", "combo", "featured_until", "30000000-0000-4000-8000-000000000003"],
  ] as const)("keeps repeated %s finalization idempotent without extending duration twice", async (_label, product, field, order) => {
    await db.exec(`delete from flitt_payment_attempts; delete from listing_boost_order_events; delete from listing_boost_orders; update listings set is_vip=false,vip_until=null,promoted_until=null,featured_until=null,featured_slot=null;`)
    await db.exec(`
      insert into listing_boost_orders(id,listing_id,seller_id,product_id,status,payment_provider,payment_method,currency,amount)
      values ('${order}','${listing}','${seller}','${product}','approved','flitt','flitt','GEL',9.90);
      insert into flitt_payment_attempts(boost_order_id,purpose,status,provider_status,response_status,provider_payment_id,provider_verified_at,provider_verification_source,user_id,currency,amount,merchant_id)
      values ('${order}','boost_order','approved','approved','success','pay-idempotent-${product}',now(),'status_api','${seller}','GEL',990,'424242');
    `)
    await db.query(`select public.finalize_flitt_boost_payment('${order}')`)
    const first = await db.query<{ ends_at: string }>(`select ends_at from listing_boost_orders where id='${order}'`)
    await db.query(`select public.finalize_flitt_boost_payment('${order}')`)
    const second = await db.query<{ ends_at: string }>(`select ends_at from listing_boost_orders where id='${order}'`)
    expect(new Date(second.rows[0].ends_at).toISOString()).toBe(new Date(first.rows[0].ends_at).toISOString())
    const state = await listingState()
    expect(new Date(state[field]!).toISOString()).toBe(new Date(first.rows[0].ends_at).toISOString())
    expect((await db.query(`select id from listing_boost_order_events where order_id='${order}' and event_type='boost_activated'`)).rows).toHaveLength(1)
  })

  it.each([
    ["VIP", "vip", "vip_until"],
    ["TOP", "top", "promoted_until"],
    ["VIP MAX", "combo", "featured_until"],
  ] as const)("reverses %s while preserving a later stacked entitlement", async (_label, product, field) => {
    await db.exec(`delete from flitt_payment_attempts; delete from listing_boost_order_events; delete from listing_boost_orders; update listings set is_vip=false,vip_until=null,promoted_until=null,featured_until=null,featured_slot=null;`)
    const firstOrder = product === "vip" ? "40000000-0000-4000-8000-000000000001" : product === "top" ? "40000000-0000-4000-8000-000000000002" : "40000000-0000-4000-8000-000000000003"
    const secondOrder = product === "vip" ? "50000000-0000-4000-8000-000000000001" : product === "top" ? "50000000-0000-4000-8000-000000000002" : "50000000-0000-4000-8000-000000000003"
    const firstEnd = "2030-01-10T00:00:00.000Z"
    const secondEnd = "2030-01-17T00:00:00.000Z"
    await addActiveOrder(firstOrder, product, firstEnd, `pay-${product}-a`)
    await addActiveOrder(secondOrder, product, secondEnd, `pay-${product}-b`)
    await db.query(`select private.reconcile_listing_boost_state('${listing}')`)
    await addReversedAttempt(firstOrder, `pay-${product}-a`)

    await db.query(`select public.reverse_flitt_boost_payment('${firstOrder}')`)
    await db.query(`select public.reverse_flitt_boost_payment('${firstOrder}')`)

    const state = await listingState()
    expect(new Date(state[field]!).toISOString()).toBe(secondEnd)
    expect((await db.query<{ status: string }>(`select status from listing_boost_orders where id='${firstOrder}'`)).rows[0].status).toBe("cancelled")
    expect((await db.query(`select id from listing_boost_order_events where order_id='${firstOrder}' and event_type='payment_returned'`)).rows).toHaveLength(1)
  })
})
