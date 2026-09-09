// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

let db: PGlite
const owner = "11111111-1111-4111-8111-111111111111"
const viewer = "22222222-2222-4222-8222-222222222222"
const story = "33333333-3333-4333-8333-333333333333"
const base = readFileSync("supabase/migrations/20260908072522_add_stories_following_v1.sql", "utf8")
const fix = readFileSync("supabase/migrations/20260909103246_harden_stories_review.sql", "utf8")

async function asUser(sql: string, role = "authenticated", uid = owner) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claims','{}',false);`)
  try { return await db.query(sql) } finally { await db.exec("reset role") }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    create table public.profiles(id uuid primary key,is_suspended boolean default false);
    create table public.listings(id uuid primary key,seller_id uuid,status text);
    create table public.user_blocks(blocker_id uuid,blocked_id uuid);
    create table public.user_action_rate_limits(user_id uuid,action text,window_started_at timestamptz,hits integer,primary key(user_id,action));
    create table public.story_views(story_id uuid,viewer_id uuid);
    create table public.messages(id uuid,story_id uuid,sender_id uuid,message_type text,body text);
    alter table public.messages enable row level security;
    create policy messages_insert on public.messages for insert to authenticated with check(true);
    grant insert on public.messages to authenticated;
    create table storage.buckets(id text primary key,public boolean);
    insert into storage.buckets values('story-media',true);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz default now(),primary key(bucket_id,name));
    alter table storage.objects enable row level security;
    grant all on storage.objects to authenticated,anon,service_role;
    -- Simulate an unrelated overly broad permissive policy; restrictive denials must still win.
    create policy broad_insert on storage.objects for insert to authenticated,anon with check(true);
    create function public.is_current_user_admin() returns boolean language sql stable as $$ select false $$;
  `)
  await db.exec(base.slice(base.indexOf("create table public.stories ("), base.indexOf("create index stories_active_created_idx")))
  await db.exec(base.slice(base.indexOf("create table public.story_listing_clicks ("), base.indexOf("create table public.story_reports (")))
  await db.exec("alter table public.stories enable row level security; alter table public.story_listing_clicks enable row level security; grant select on public.stories to anon,authenticated; create policy active_stories on public.stories for select using(deleted_at is null and expires_at>now());")
  await db.exec(base.slice(base.indexOf("create or replace function public.consume_action_rate_limit("), base.indexOf("create or replace function public.set_user_followed(")))
  await db.exec(fix)
  await db.exec(`insert into profiles(id) values('${owner}'),('${viewer}');`)
}, 30_000)
afterAll(async () => { await db?.close() })

async function plan() {
  const result = await asUser("select * from public.prepare_story_upload('image/jpeg',3)")
  return result.rows[0] as { story_id: string; media_path: string }
}

describe("Story PostgreSQL security boundaries", () => {
  it("rejects direct anonymous and authenticated Storage writes even at an authorized path", async () => {
    const p = await plan()
    for (const role of ["anon", "authenticated"]) {
      await expect(asUser(`insert into storage.objects(bucket_id,name,metadata) values('story-media','${p.media_path}','{"size":3,"mimetype":"image/jpeg","cacheControl":"max-age=0"}')`, role, role === "anon" ? "" : owner)).rejects.toThrow(/row-level security/)
    }
  })
  it("rejects a privileged upload without a plan or into another owner's path", async () => {
    const p = await plan()
    await expect(db.exec(`insert into storage.objects(bucket_id,name,metadata) values('story-media','${p.media_path.replace(owner,viewer)}','{"size":3,"mimetype":"image/jpeg","cacheControl":"max-age=0"}')`)).rejects.toThrow("story_upload_not_authorized")
  })
  it("enforces exact MIME and size, single use, expiry and no replacement", async () => {
    const p = await plan()
    const insert = (metadata: string) => db.exec(`insert into storage.objects(bucket_id,name,metadata) values('story-media','${p.media_path}','${metadata}')`)
    await expect(insert('{"size":4,"mimetype":"image/jpeg","cacheControl":"max-age=0"}')).rejects.toThrow("invalid_story_media_metadata")
    await expect(insert('{"size":3,"mimetype":"image/png","cacheControl":"max-age=0"}')).rejects.toThrow("invalid_story_media_metadata")
    await expect(insert('{"size":3,"mimetype":"image/jpeg","cacheControl":"max-age=86400"}')).rejects.toThrow("invalid_story_media_metadata")
    await insert('{"size":3,"mimetype":"image/jpeg","cacheControl":"max-age=0"}')
    await expect(db.exec(`update storage.objects set metadata='{"size":2}' where name='${p.media_path}'`)).rejects.toThrow("story_media_immutable")
    await db.exec(`delete from storage.objects where name='${p.media_path}'`)
    await expect(insert('{"size":3,"mimetype":"image/jpeg","cacheControl":"max-age=0"}')).rejects.toThrow("story_upload_not_authorized")
    const expired = await plan()
    await db.exec(`update story_upload_plans set expires_at=now()-interval '1 second' where story_id='${expired.story_id}'`)
    await expect(db.exec(`insert into storage.objects(bucket_id,name,metadata) values('story-media','${expired.media_path}','{"size":3,"mimetype":"image/jpeg","cacheControl":"max-age=0"}')`)).rejects.toThrow("story_upload_not_authorized")
  })
  it("blocks direct publish and client attestation before trusted verification", async () => {
    const p = await plan()
    await expect(asUser(`update story_upload_plans set validated_at=now() where story_id='${p.story_id}'`)).rejects.toThrow(/permission denied/)
    await expect(asUser(`select create_story('${p.story_id}','${p.media_path}','image')`)).rejects.toThrow("story_upload_not_validated")
    await db.exec(`insert into storage.objects(bucket_id,name,metadata) values('story-media','${p.media_path}','{"size":3,"mimetype":"image/jpeg","cacheControl":"max-age=0"}'); update story_upload_plans set validated_at=now() where story_id='${p.story_id}';`)
    expect((await asUser(`select create_story('${p.story_id}','${p.media_path}','image')`)).rows).toHaveLength(1)
    await expect(asUser(`select create_story('${p.story_id}','${p.media_path}','image')`)).rejects.toThrow("story_upload_not_validated")
    expect((await asUser(`select abort_story_upload('${p.story_id}') as path`)).rows[0]).toEqual({path:null})
  })
  it("rejects anonymous direct click inserts and RPC execution; deduplicates viewers and excludes self and blocks", async () => {
    await db.exec(`insert into listings values('${story}','${owner}','active'); insert into stories(id,user_id,media_path,media_type,linked_listing_id,created_at,expires_at) values('${story}','${owner}','test/path/test.jpg','image','${story}',now(),now()+interval '24 hours');`)
    await expect(asUser(`insert into story_listing_clicks(story_id,user_id) values('${story}',null)`,"anon","")).rejects.toThrow(/permission denied/)
    await expect(asUser(`select record_story_listing_click('${story}')`,"anon","")).rejects.toThrow(/permission denied/)
    expect((await asUser(`select record_story_listing_click('${story}') as recorded`)).rows[0]).toEqual({recorded:false})
    expect((await asUser(`select record_story_listing_click('${story}') as recorded`,"authenticated",viewer)).rows[0]).toEqual({recorded:true})
    expect((await asUser(`select record_story_listing_click('${story}') as recorded`,"authenticated",viewer)).rows[0]).toEqual({recorded:false})
    await db.exec(`delete from story_listing_clicks; insert into user_blocks values('${owner}','${viewer}')`)
    expect((await asUser(`select record_story_listing_click('${story}') as recorded`,"authenticated",viewer)).rows[0]).toEqual({recorded:false})
  })
  it("rejects direct forged Story replies", async () => {
    await expect(asUser(`insert into messages(id,story_id,sender_id,message_type,body) values(gen_random_uuid(),'${story}','${owner}','story_reply','hello')`)).rejects.toThrow(/row-level security/)
  })
  it("finds abandoned pre-plan objects and expired media for Storage API cleanup", async () => {
    await db.exec(`alter table storage.objects disable trigger guard_story_storage_write;
      insert into storage.objects(bucket_id,name,metadata,created_at) values('story-media','legacy/orphan.jpg','{}',now()-interval '3 hours'),('story-media','recent/orphan.jpg','{}',now());
      alter table storage.objects enable trigger guard_story_storage_write;`)
    const candidates=await db.query<{media_path:string}>("select * from list_expired_story_media_for_cleanup(500)")
    expect(candidates.rows.map(row=>row.media_path)).toContain("legacy/orphan.jpg")
    expect(candidates.rows.map(row=>row.media_path)).not.toContain("recent/orphan.jpg")
    await expect(asUser("select * from list_expired_story_media_for_cleanup(500)")).rejects.toThrow(/permission denied/)
  })
  it("Storage preflight rolls back and actual upload consumes the plan", async () => {
    const p=await plan()
    await db.exec(`begin; insert into storage.objects(bucket_id,name) values('story-media','${p.media_path}'); rollback;`)
    await db.exec(`begin; insert into storage.objects(bucket_id,name,metadata) values('story-media','${p.media_path}','{"mimetype":"image/jpeg","cacheControl":"max-age=0","contentLength":3}'); rollback;`)
    await db.exec(`insert into storage.objects(bucket_id,name,metadata) values('story-media','${p.media_path}','{"mimetype":"image/jpeg","cacheControl":"max-age=0","size":3}');`)
    const result=await db.query<{uploaded_at:string}>(`select uploaded_at from story_upload_plans where story_id='${p.story_id}'`)
    expect(result.rows[0].uploaded_at).toBeTruthy()
  })
  it("cannot bypass the 20/hour plan quota by calling the RPC directly", async () => {
    await db.exec(`delete from user_action_rate_limits where user_id='${viewer}'`)
    for (let i=0;i<20;i++) await asUser("select * from prepare_story_upload('image/jpeg',3)","authenticated",viewer)
    await expect(asUser("select * from prepare_story_upload('image/jpeg',3)","authenticated",viewer)).rejects.toThrow("story_rate_limited")
  })
})
