// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

let db: PGlite

const owner = "11111111-1111-4111-8111-111111111111"
const admin = "22222222-2222-4222-8222-222222222222"
const adId = "33333333-3333-4333-8333-333333333333"
const orderId = "44444444-4444-4444-8444-444444444444"

function migrationFunction(path: string, functionName: string) {
  const sql = readFileSync(path, "utf8")
  const start = sql.indexOf(`create or replace function public.${functionName}`)
  const end = sql.indexOf(`revoke all on function public.${functionName}`, start)
  if (start < 0 || end < 0) throw new Error(`Could not locate ${functionName}`)
  return sql.slice(start, end)
}

async function insertPaidOrder(id = orderId, linkedAd = adId) {
  await db.exec(`
    insert into ads (id, placement_key, title, advertiser_name, submitted_by, review_status)
    values ('${linkedAd}', 'home_hero_left', 'Test ad', 'Test brand', '${owner}', 'pending');
    insert into ad_orders (
      id, ad_id, user_id, product_id, status, amount, currency,
      product_name_snapshot, duration_days_snapshot, payment_provider, paid_at
    ) values (
      '${id}', '${linkedAd}', '${owner}', 'home_brand_ad_7d', 'paid_pending_review',
      49.90, 'GEL', 'Home Brand Ad', 7, 'flitt', now()
    );
  `)
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create table profiles (id uuid primary key, is_admin boolean not null default false);
    create table ads (
      id uuid primary key,
      placement_key text not null,
      title text,
      description text,
      image_url text,
      target_url text,
      is_active boolean not null default false,
      starts_at timestamptz,
      ends_at timestamptz,
      priority integer not null default 0,
      advertiser_name text,
      submitted_by uuid,
      review_status text not null default 'approved',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table ad_products (
      id text primary key,
      name text not null,
      duration_days integer not null,
      price numeric not null,
      currency text not null
    );
    create table ad_orders (
      id uuid primary key,
      ad_id uuid not null unique references ads(id),
      user_id uuid not null,
      product_id text not null references ad_products(id),
      status text not null,
      amount numeric not null,
      currency text not null,
      product_name_snapshot text not null,
      duration_days_snapshot integer not null,
      description_snapshot text,
      payment_provider text not null,
      provider_payment_id text,
      provider_status text,
      paid_at timestamptz,
      approved_at timestamptz,
      reviewed_by uuid,
      starts_at timestamptz,
      ends_at timestamptz,
      selected_placement text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table flitt_payment_attempts (
      order_id uuid default gen_random_uuid(),
      ad_order_id uuid,
      boost_order_id uuid,
      user_id uuid,
      mode text default 'test',
      purpose text,
      amount integer,
      currency text,
      merchant_id text,
      provider_payment_id text,
      provider_status text,
      response_status text,
      provider_verified_at timestamptz,
      provider_verification_source text,
      status text,
      callback_count integer default 0,
      last_callback_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    insert into profiles (id, is_admin) values ('${admin}', true), ('${owner}', false);
    insert into ad_products (id, name, duration_days, price, currency)
    values ('home_brand_ad_7d', 'Home Brand Ad', 7, 49.90, 'GEL');
  `)

  await db.exec(migrationFunction(
    "supabase/migrations/20260921153000_harden_self_service_brand_ad_finalization.sql",
    "finalize_flitt_ad_payment",
  ))
  for (const functionName of [
    "reverse_flitt_ad_payment",
    "approve_self_service_ad",
    "reconcile_self_service_brand_ads",
  ]) {
    await db.exec(migrationFunction(
      "supabase/migrations/20260921123000_add_self_service_brand_ads.sql",
      functionName,
    ))
  }
})

beforeEach(async () => {
  await db.exec("delete from flitt_payment_attempts; delete from ad_orders; delete from ads;")
})

afterAll(async () => db.close())

describe("self-service Brand Ad database invariants", () => {
  it("requires authoritative provider verification and finalizes exactly once", async () => {
    await db.exec(`
      insert into ads (id, placement_key, submitted_by, review_status)
      values ('${adId}', 'home_hero_left', '${owner}', 'pending');
      insert into ad_orders (
        id, ad_id, user_id, product_id, status, amount, currency,
        product_name_snapshot, duration_days_snapshot, payment_provider
      ) values (
        '${orderId}', '${adId}', '${owner}', 'home_brand_ad_7d', 'pending_payment',
        49.90, 'GEL', 'Home Brand Ad', 7, 'flitt'
      );
      insert into flitt_payment_attempts (
        ad_order_id, user_id, purpose, amount, currency, merchant_id,
        provider_payment_id, provider_status, response_status, status
      ) values (
        '${orderId}', '${owner}', 'ad_order', 4990, 'GEL', '424242',
        'pay-brand-ad', 'approved', 'success', 'approved'
      );
    `)

    await expect(db.query(`select public.finalize_flitt_ad_payment('${orderId}')`)).rejects.toThrow(
      /not independently verified/i,
    )

    const verifiedAt = "2026-09-21T12:00:00.000Z"
    await db.exec(`
      update flitt_payment_attempts
      set provider_verified_at = '${verifiedAt}', provider_verification_source = 'status_api'
      where ad_order_id = '${orderId}';
    `)
    const first = await db.query<{ result: { changed: boolean } }>(
      `select public.finalize_flitt_ad_payment('${orderId}') as result`,
    )
    const second = await db.query<{ result: { changed: boolean } }>(
      `select public.finalize_flitt_ad_payment('${orderId}') as result`,
    )
    const order = (await db.query<{ status: string; paid_at: string }>(
      `select status, paid_at from ad_orders where id = '${orderId}'`,
    )).rows[0]

    expect(first.rows[0].result.changed).toBe(true)
    expect(second.rows[0].result.changed).toBe(false)
    expect(order.status).toBe("paid_pending_review")
    expect(new Date(order.paid_at).toISOString()).toBe(verifiedAt)
  })

  it("refuses unpaid approval", async () => {
    await db.exec(`
      insert into ads (id, placement_key, submitted_by, review_status)
      values ('${adId}', 'home_hero_left', '${owner}', 'pending');
      insert into ad_orders (
        id, ad_id, user_id, product_id, status, amount, currency,
        product_name_snapshot, duration_days_snapshot, payment_provider
      ) values (
        '${orderId}', '${adId}', '${owner}', 'home_brand_ad_7d', 'pending_payment',
        49.90, 'GEL', 'Home Brand Ad', 7, 'flitt'
      );
    `)
    await expect(db.query(`select public.approve_self_service_ad('${adId}', '${admin}')`)).rejects.toThrow(
      /not been paid and verified/i,
    )
  })

  it("chooses the earliest slot and schedules exactly seven days from its availability", async () => {
    const leftAd = "55555555-5555-4555-8555-555555555555"
    const rightAd = "66666666-6666-4666-8666-666666666666"
    await db.exec(`
      insert into ads (id, placement_key, is_active, starts_at, ends_at)
      values
        ('${leftAd}', 'home_hero_left', true, now() - interval '1 day', now() + interval '3 days'),
        ('${rightAd}', 'home_hero_right', true, now() - interval '1 day', now() + interval '1 day');
    `)
    await insertPaidOrder()
    await db.query(`select public.approve_self_service_ad('${adId}', '${admin}')`)

    const order = (await db.query<{ selected_placement: string; starts_at: string; ends_at: string }>(
      `select selected_placement, starts_at, ends_at from ad_orders where id = '${orderId}'`,
    )).rows[0]
    const rightEnd = (await db.query<{ ends_at: string }>(`select ends_at from ads where id = '${rightAd}'`)).rows[0].ends_at

    expect(order.selected_placement).toBe("home_hero_right")
    expect(new Date(order.starts_at).toISOString()).toBe(new Date(rightEnd).toISOString())
    expect(new Date(order.ends_at).getTime() - new Date(order.starts_at).getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it("serially approved ads do not double-book the two slots", async () => {
    const adTwo = "77777777-7777-4777-8777-777777777777"
    const orderTwo = "88888888-8888-4888-8888-888888888888"
    const adThree = "99999999-9999-4999-8999-999999999999"
    const orderThree = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    await insertPaidOrder()
    await insertPaidOrder(orderTwo, adTwo)
    await insertPaidOrder(orderThree, adThree)

    await db.query(`select public.approve_self_service_ad('${adId}', '${admin}')`)
    await db.query(`select public.approve_self_service_ad('${adTwo}', '${admin}')`)
    await db.query(`select public.approve_self_service_ad('${adThree}', '${admin}')`)

    const rows = (await db.query<{ id: string; selected_placement: string; starts_at: string; ends_at: string }>(
      "select id, selected_placement, starts_at, ends_at from ad_orders order by approved_at, id",
    )).rows
    expect(new Set(rows.slice(0, 2).map((row) => row.selected_placement))).toEqual(
      new Set(["home_hero_left", "home_hero_right"]),
    )
    const firstSlot = rows.filter((row) => row.selected_placement === rows[2].selected_placement)[0]
    expect(new Date(rows[2].starts_at).toISOString()).toBe(new Date(firstSlot.ends_at).toISOString())
  })

  it("reversal deactivates an active ad and is safe to repeat", async () => {
    await insertPaidOrder()
    await db.exec(`
      update ads set is_active = true, review_status = 'approved', starts_at = now(), ends_at = now() + interval '7 days'
      where id = '${adId}';
      update ad_orders set status = 'active', provider_payment_id = 'pay-reversed', provider_status = 'approved'
      where id = '${orderId}';
      insert into flitt_payment_attempts (
        ad_order_id, user_id, purpose, amount, currency, merchant_id,
        provider_payment_id, provider_status, response_status, status
      ) values (
        '${orderId}', '${owner}', 'ad_order', 4990, 'GEL', '424242',
        'pay-reversed', 'reversed', 'success', 'reversed'
      );
    `)

    await db.query(`select public.reverse_flitt_ad_payment('${orderId}')`)
    await db.query(`select public.reverse_flitt_ad_payment('${orderId}')`)

    const state = (await db.query<{ order_status: string; is_active: boolean }>(`
      select o.status as order_status, a.is_active
      from ad_orders o join ads a on a.id = o.ad_id
      where o.id = '${orderId}'
    `)).rows[0]
    expect(state).toEqual({ order_status: "reversed", is_active: false })
  })

  it("reconciles scheduled and expired orders without page visits", async () => {
    const expiredAd = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    const expiredOrder = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    await insertPaidOrder()
    await insertPaidOrder(expiredOrder, expiredAd)
    await db.exec(`
      update ads set is_active = true, review_status = 'approved', starts_at = now() - interval '1 hour', ends_at = now() + interval '1 day'
      where id = '${adId}';
      update ad_orders set status = 'scheduled', starts_at = now() - interval '1 hour', ends_at = now() + interval '1 day'
      where id = '${orderId}';
      update ads set is_active = true, review_status = 'approved', starts_at = now() - interval '8 days', ends_at = now() - interval '1 day'
      where id = '${expiredAd}';
      update ad_orders set status = 'active', starts_at = now() - interval '8 days', ends_at = now() - interval '1 day'
      where id = '${expiredOrder}';
    `)

    await db.query("select public.reconcile_self_service_brand_ads()")
    const rows = (await db.query<{ id: string; status: string; is_active: boolean }>(`
      select o.id, o.status, a.is_active
      from ad_orders o join ads a on a.id = o.ad_id
      order by o.id
    `)).rows
    expect(rows.find((row) => row.id === orderId)).toMatchObject({ status: "active", is_active: true })
    expect(rows.find((row) => row.id === expiredOrder)).toMatchObject({ status: "expired", is_active: false })
  })
})
