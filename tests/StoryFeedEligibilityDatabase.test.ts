import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { expect, it } from "vitest"

it("preserves migration RLS and follow uniqueness through follow/unfollow", async () => {
  const db = new PGlite()
  const base = readFileSync("supabase/migrations/20260908072522_add_stories_following_v1.sql", "utf8")
  const viewer = "00000000-0000-4000-8000-000000000001"
  const owner = "00000000-0000-4000-8000-000000000002"
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table profiles(id uuid primary key,is_suspended boolean default false);
      create table listings(id uuid primary key);
      create table user_blocks(blocker_id uuid,blocked_id uuid);
      create table story_mutes(user_id uuid,muted_user_id uuid);
      insert into profiles values('${viewer}',false),('${owner}',false);`)
    await db.exec(base.slice(base.indexOf("create table public.user_follows"), base.indexOf("create table public.stories")))
    await db.exec(base.slice(base.indexOf("create table public.stories"), base.indexOf("create table public.story_views")))
    await db.exec(base.slice(base.indexOf("create or replace function public.set_user_followed("), base.indexOf("create or replace function public.create_story(")))
    await db.exec(`select set_config('request.jwt.claim.sub','${viewer}',false);
      select set_user_followed('${owner}',true); select set_user_followed('${owner}',true);`)
    expect((await db.query<{ n: number }>("select count(*)::int n from user_follows")).rows[0].n).toBe(1)
    await db.exec(`select set_user_followed('${owner}',false);`)
    expect((await db.query<{ n: number }>("select count(*)::int n from user_follows")).rows[0].n).toBe(0)
    await db.exec(`alter table stories enable row level security;
      grant usage on schema public,auth to anon,authenticated;
      grant select on stories,profiles to anon,authenticated;
      grant select on user_blocks,story_mutes to authenticated;
      insert into stories(user_id,media_path,media_type,created_at,expires_at) values('${owner}','valid/path/image.jpg','image',now(),now()+interval '24 hours');`)
    await db.exec(readFileSync("supabase/migrations/20260910162000_fix_story_public_read_rls.sql", "utf8"))
    async function visible(role: string) {
      await db.exec(`set role ${role}`)
      const result = await db.query<{ n: number }>("select count(*)::int n from stories")
      await db.exec("reset role")
      return result.rows[0].n
    }
    expect(await visible("anon")).toBe(1)
    expect(await visible("authenticated")).toBe(1)
    await db.exec(`insert into story_mutes values('${viewer}','${owner}')`)
    expect(await visible("authenticated")).toBe(0)
    expect(await visible("anon")).toBe(1)
    await db.exec(`delete from story_mutes; insert into user_blocks values('${owner}','${viewer}')`)
    expect(await visible("authenticated")).toBe(0)
    await db.exec(`delete from user_blocks; insert into user_blocks values('${viewer}','${owner}')`)
    expect(await visible("authenticated")).toBe(0)
    await db.exec(`delete from user_blocks; update profiles set is_suspended=true where id='${owner}'`)
    expect(await visible("anon")).toBe(0)
    expect(await visible("authenticated")).toBe(0)
  } finally { await db.close() }
}, 15000)
