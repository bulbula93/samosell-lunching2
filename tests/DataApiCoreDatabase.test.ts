// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

let db: PGlite
const owner = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"
const outsider = "55555555-5555-4555-8555-555555555555"
const active = "33333333-3333-4333-8333-333333333333"
const draft = "44444444-4444-4444-8444-444444444444"

async function asRole(sql: string, role = "authenticated", uid = owner) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false);`)
  try { return await db.query(sql) } finally { await db.exec("reset role") }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
    grant usage on schema public,auth to anon,authenticated,service_role;
  `)
  // PGlite has core gen_random_uuid(); omit only the unavailable pgcrypto extension.
  await db.exec(readFileSync("supabase/01_categories.sql", "utf8"))
  await db.exec(readFileSync("supabase/02_marketplace_schema.sql", "utf8").replace("create extension if not exists pgcrypto;", ""))
  await db.exec(`
    insert into auth.users(id) values ('${owner}'),('${other}'),('${outsider}');
    insert into public.listings(id,seller_id,category_id,title,slug,price,status)
      values ('${active}','${owner}',1,'Visible','visible',10,'active'),
             ('${draft}','${owner}',1,'Private','private',10,'draft');
    insert into public.listing_images(listing_id,image_url) values ('${active}','https://example.invalid/photo.jpg');
    insert into public.chats(id,listing_id,buyer_id,seller_id)
      values ('66666666-6666-4666-8666-666666666666','${active}','${other}','${owner}');
    insert into public.messages(chat_id,sender_id,body)
      values ('66666666-6666-4666-8666-666666666666','${owner}','Participant message');
  `)
}, 30000)
afterAll(async () => { await db?.close() })

describe("core Data API grants and actual RLS on a fresh database", () => {
  it("serves only the active public catalog with its photo", async () => {
    expect((await asRole("select id,cover_image_url from public.listings_catalog", "anon", "")).rows)
      .toEqual([{ id: active, cover_image_url: "https://example.invalid/photo.jpg" }])
    await expect(asRole("insert into public.listings(title) values ('blocked')", "anon", "")).rejects.toThrow(/permission denied/)
  })

  it("allows owners to publish and attach media while rejecting another seller's writes", async () => {
    expect((await asRole(`update public.listings set status='active' where id='${draft}' returning id`, "authenticated", other)).rows).toEqual([])
    await expect(asRole(`insert into public.listing_images(listing_id,image_url) values ('${draft}','forged')`, "authenticated", other)).rejects.toThrow(/row-level security/)
    expect((await asRole(`update public.listings set status='active' where id='${draft}' returning id`)).rows).toEqual([{ id: draft }])
    await asRole(`insert into public.listing_images(listing_id,image_url) values ('${draft}','owned-photo')`)
  })

  it("keeps favorites scoped to their owner", async () => {
    await asRole(`insert into public.favorites(user_id,listing_id) values ('${owner}','${active}')`)
    expect((await asRole("select listing_id from public.favorites")).rows).toEqual([{ listing_id: active }])
    expect((await asRole("select listing_id from public.favorites", "authenticated", other)).rows).toEqual([])
    await expect(asRole(`insert into public.favorites(user_id,listing_id) values ('${owner}','${draft}')`, "authenticated", other)).rejects.toThrow(/row-level security/)
    await expect(asRole("select * from public.favorites", "anon", "")).rejects.toThrow(/permission denied/)
  })

  it("allows own profile updates and hides chats from unrelated users", async () => {
    expect((await asRole(`update public.profiles set city='Tbilisi' where id='${owner}' returning id`)).rows).toHaveLength(1)
    expect((await asRole(`update public.profiles set city='forged' where id='${owner}' returning id`, "authenticated", other)).rows).toEqual([])
    expect((await asRole("select body from public.messages")).rows).toEqual([{ body: "Participant message" }])
    expect((await asRole("select id from public.chats", "authenticated", outsider)).rows).toEqual([])
    expect((await asRole("select body from public.messages", "authenticated", outsider)).rows).toEqual([])
    await expect(asRole("insert into public.messages(body) values ('forged')")).rejects.toThrow(/permission denied/)
  })

  it("supports a server insert with generated IDs without inherited table or sequence grants", async () => {
    expect((await asRole("insert into public.categories(name,slug) values ('Fixture','fixture') returning id", "service_role", "")).rows).toHaveLength(1)
    await expect(asRole("insert into public.categories(name,slug) values ('blocked','blocked')", "authenticated")).rejects.toThrow(/permission denied/)
  })
})
