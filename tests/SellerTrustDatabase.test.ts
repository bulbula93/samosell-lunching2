// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, expect, it } from "vitest"
const a = "11111111-1111-4111-8111-111111111111"
const b = "22222222-2222-4222-8222-222222222222"
let db: PGlite
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated;
    create table profiles(id uuid primary key,is_suspended boolean default false);
    create table listings(seller_id uuid,status text);
    create table listing_reviews(seller_id uuid,score integer);
    create table marketplace_orders(seller_id uuid,buyer_id uuid,private_details text);
    alter table marketplace_orders enable row level security;
    create policy participant on marketplace_orders for select to authenticated using(seller_id = nullif(current_setting('request.jwt.claim.sub',true),'')::uuid or buyer_id = nullif(current_setting('request.jwt.claim.sub',true),'')::uuid);
    grant select on marketplace_orders, listing_reviews to authenticated;
    grant select on listing_reviews to anon;
    insert into profiles(id) values('${a}'),('${b}');
    insert into listings values('${a}','active'),('${a}','active'),('${a}','sold'),('${a}','archived'),('${a}','reserved'),('${a}','deleted'),('${b}','active'),('${b}','sold'),('${b}','sold');
    insert into listing_reviews values('${a}',5),('${a}',4),('${a}',5),('${b}',1);
    insert into marketplace_orders values('${b}','${b}','private B order');
  `)
  await db.exec(readFileSync("supabase/migrations/20260830225342_add_public_seller_listing_counts.sql", "utf8"))
  const migration = readFileSync("supabase/migrations/20260810153247_secure_seller_reviews.sql", "utf8")
  const view = migration.match(/create (?:or replace )?view public\.seller_review_summaries[\s\S]*?;/i)?.[0]
  if (!view) throw new Error("Missing canonical review view")
  await db.exec(view + "; grant select on seller_review_summaries to anon,authenticated;")
}, 30_000)
afterAll(async () => { await db?.close() })
it("counts only active/sold listings, without double counting orders or other sellers", async () => {
  await db.exec("set role anon")
  try {
    expect((await db.query(`select * from get_public_seller_listing_counts('${a}')`)).rows).toEqual([{ active_count: 2, sold_count: 1 }])
    expect((await db.query(`select * from get_public_seller_listing_counts('${b}')`)).rows).toEqual([{ active_count: 1, sold_count: 2 }])
    expect((await db.query(`select review_count,average_score from seller_review_summaries where seller_id='${a}'`)).rows).toEqual([{ review_count: 3, average_score: "4.67" }])
  } finally { await db.exec("reset role") }
})
it("seller A cannot read seller B's private order while public metrics remain available", async () => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`)
  try {
    expect((await db.query("select * from marketplace_orders")).rows).toHaveLength(0)
    expect((await db.query(`select * from get_public_seller_listing_counts('${b}')`)).rows).toEqual([{ active_count: 1, sold_count: 2 }])
  } finally { await db.exec("reset role") }
})
it("suppresses counts for suspended sellers", async () => {
  await db.exec(`update profiles set is_suspended=true where id='${b}'`)
  expect((await db.query(`select * from get_public_seller_listing_counts('${b}')`)).rows).toEqual([{ active_count: 0, sold_count: 0 }])
})
