// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

let db: PGlite
const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"
const migration = readFileSync("supabase/migrations/20261026092938_security_storage_and_rpc_hardening.sql","utf8")
async function asUser(sql: string, uid=A, role="authenticated") {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false)`)
  try { return await db.query(sql) } finally { await db.exec("reset role") }
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table storage.objects(bucket_id text,name text,metadata jsonb,primary key(bucket_id,name));
    alter table storage.objects enable row level security;
    grant all on storage.objects to anon,authenticated,service_role;
    create table public.listings(seller_id uuid,status text,created_at timestamptz,updated_at timestamptz);
    create table public.profiles(id uuid,is_suspended boolean,created_at timestamptz);
    create table public.chats(created_at timestamptz);
    create function public.get_public_seller_listing_counts(uuid) returns int language sql as $$select 0$$;
    create policy "authenticated can insert avatars and branding" on storage.objects for insert to authenticated with check(bucket_id in ('avatars','store-branding'));
    create policy "authenticated can update avatars and branding" on storage.objects for update to authenticated using(bucket_id in ('avatars','store-branding')) with check(bucket_id in ('avatars','store-branding'));
    create policy "authenticated can delete avatars and branding" on storage.objects for delete to authenticated using(bucket_id in ('avatars','store-branding'));
    create policy public_read on storage.objects for select using(true);
  `)
  // Apply the exact complete release migration twice, testing idempotency.
  await db.exec(migration)
  await db.exec(migration)
  // A later permissive policy cannot defeat the restrictive namespace checks.
  await db.exec("create policy accidental_broad on storage.objects for all to anon,authenticated using(true) with check(true)")
},30000)
afterAll(async()=>{ await db?.close() })
describe("branding PostgreSQL RLS",()=>{
  for(const bucket of ["avatars","store-branding"]) {
    it(bucket+": owner lifecycle/public read survives legacy upsert workflow",async()=>{
      const path=A+"/owner.png"
      await asUser(`insert into storage.objects values('${bucket}','${path}','{}')`)
      await asUser(`insert into storage.objects values('${bucket}','${path}','{"updated":true}') on conflict(bucket_id,name) do update set metadata=excluded.metadata`)
      expect((await asUser(`select * from storage.objects where bucket_id='${bucket}' and name='${path}'`,"","anon")).rows).toHaveLength(1)
      expect((await asUser(`update storage.objects set metadata='{}' where bucket_id='${bucket}' and name='${path}' returning name`,B)).rows).toHaveLength(0)
      await expect(asUser(`insert into storage.objects values('${bucket}','${A}/foreign.png','{}')`,B)).rejects.toThrow(/row-level security/)
      await expect(asUser(`insert into storage.objects values('${bucket}','${path}','{}') on conflict(bucket_id,name) do update set metadata=excluded.metadata`,B)).rejects.toThrow(/row-level security/)
      await expect(asUser(`update storage.objects set name='${B}/stolen.png' where bucket_id='${bucket}' and name='${path}'`)).rejects.toThrow(/row-level security/)
      expect((await asUser(`delete from storage.objects where bucket_id='${bucket}' and name='${path}' returning name`,B)).rows).toHaveLength(0)
      await expect(asUser(`insert into storage.objects values('${bucket}','${A}/anon.png','{}')`,"","anon")).rejects.toThrow(/row-level security/)
      expect((await asUser(`delete from storage.objects where bucket_id='${bucket}' and name='${path}' returning name`)).rows).toHaveLength(1)
    })
  }
  it("does not alter the existing policy decision for unrelated buckets",async()=>{
    await asUser(`insert into storage.objects values('unrelated','${B}/test','{}')`)
    expect((await asUser("select * from storage.objects where bucket_id='unrelated'")).rows).toHaveLength(1)
  })
  it("internal growth metrics are service-only",async()=>{
    for (const role of ["anon","authenticated"]) await expect(asUser("select public.marketing_growth_snapshot()",A,role)).rejects.toThrow(/permission denied/)
    expect((await asUser("select public.marketing_growth_snapshot()",A,"service_role")).rows).toHaveLength(1)
  })
})
