// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { beforeAll, afterAll, expect, it } from "vitest"

const owner = "11111111-1111-4111-8111-111111111111"
const viewer = "22222222-2222-4222-8222-222222222222"
const other = "33333333-3333-4333-8333-333333333333"
const story = "44444444-4444-4444-8444-444444444444"
const chat = "55555555-5555-4555-8555-555555555555"
let db: PGlite
async function asUser(sql: string, uid = viewer, role = "authenticated") {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false)`)
  try { return await db.query(sql) } finally { await db.exec("reset role") }
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema auth,public to authenticated,anon;
    create table profiles(id uuid primary key,is_suspended boolean default false,full_name text,username text);
    create table stories(id uuid primary key,user_id uuid references profiles,deleted_at timestamptz,expires_at timestamptz);
    alter table stories enable row level security;
    create policy active_stories on stories for select using(deleted_at is null and expires_at>now());
    grant select on stories to authenticated,anon;
    create table user_blocks(blocker_id uuid,blocked_id uuid);
    create table story_mutes(user_id uuid,muted_user_id uuid);
    create table user_action_rate_limits(user_id uuid,action text,window_started_at timestamptz,hits integer,primary key(user_id,action));
    create table chats(id uuid primary key,buyer_id uuid,seller_id uuid,listing_id uuid);
    create table messages(id uuid primary key,story_id uuid,chat_id uuid,sender_id uuid,body text,message_type text);
    create table notifications(user_id uuid,type text,title text,body text,href text,actor_id uuid,listing_id uuid,chat_id uuid,event_key text unique,metadata jsonb,read_at timestamptz);
    insert into profiles(id,username) values('${owner}','author'),('${viewer}','reader'),('${other}','other');
    insert into stories values('${story}','${owner}',null,now()+interval '1 day');
    insert into chats values('${chat}','${owner}','${viewer}',null);
  `)
  await db.exec(readFileSync("supabase/migrations/20260910161733_story_likes_and_reply_notifications.sql", "utf8"))
}, 30_000)
afterAll(async () => { await db?.close() })

it("denies direct writes and anonymous RPC execution", async () => {
  await expect(asUser(`insert into story_likes values('${story}','${viewer}',now())`)).rejects.toThrow(/permission denied/)
  await expect(asUser(`select set_story_liked('${story}',true)`, "", "anon")).rejects.toThrow(/permission denied/)
  await expect(asUser(`select set_story_liked('${story}',true)`, owner)).rejects.toThrow("self_story_like")
})

it("deduplicates likes, creates no chat message, and allows unlike", async () => {
  await asUser(`select set_story_liked('${story}',true)`)
  await asUser(`select set_story_liked('${story}',true)`)
  expect((await db.query("select * from story_likes")).rows).toHaveLength(1)
  expect((await db.query("select * from messages")).rows).toHaveLength(0)
  expect((await db.query("select * from notifications")).rows).toHaveLength(0)
  await asUser(`select set_story_liked('${story}',false)`)
  expect((await db.query("select * from story_likes")).rows).toHaveLength(0)
})

it("exposes counts only to the Story author and a viewer's own liked state", async () => {
  await asUser(`select set_story_liked('${story}',true)`)
  expect((await asUser(`select * from get_story_like_summary(array['${story}']::uuid[])`, owner)).rows[0]).toMatchObject({ like_count: 1 })
  expect((await asUser(`select * from get_story_like_summary(array['${story}']::uuid[])`)).rows[0]).toMatchObject({ liked: true, like_count: null })
  expect((await asUser("select * from story_likes", other)).rows).toHaveLength(0)
})

it("rejects either block direction, mute, suspension, expired and deleted Stories", async () => {
  for (const [from,to] of [[owner,viewer],[viewer,owner]]) {
    await db.exec(`insert into user_blocks values('${from}','${to}')`)
    await expect(asUser(`select set_story_liked('${story}',true)`)).rejects.toThrow("interaction_blocked")
    await db.exec("delete from user_blocks")
  }
  await db.exec(`insert into story_mutes values('${viewer}','${owner}')`)
  await expect(asUser(`select set_story_liked('${story}',true)`)).rejects.toThrow("interaction_blocked")
  await db.exec(`delete from story_mutes; update profiles set is_suspended=true where id='${viewer}'`)
  await expect(asUser(`select set_story_liked('${story}',true)`)).rejects.toThrow("account_suspended")
  await db.exec(`update profiles set is_suspended=false; update stories set expires_at=now()-interval '1 second'`)
  await expect(asUser(`select set_story_liked('${story}',true)`)).rejects.toThrow("story_unavailable")
  expect((await asUser(`select * from get_story_like_summary(array['${story}']::uuid[])`, owner)).rows).toHaveLength(0)
  await db.exec("update stories set expires_at=now()+interval '1 day',deleted_at=now()")
  await expect(asUser(`select set_story_liked('${story}',true)`)).rejects.toThrow("story_unavailable")
  await db.exec("update stories set deleted_at=null")
})

it("bounds state changes with a server-controlled quota", async () => {
  await db.exec(`update user_action_rate_limits set hits=60 where user_id='${viewer}' and action='story_like'`)
  await expect(asUser(`select set_story_liked('${story}',false)`)).rejects.toThrow("story_like_rate_limited")
})

it("commits an unread notification with a text Story reply, using its author and chat", async () => {
  await db.exec(`insert into messages values('66666666-6666-4666-8666-666666666666','${story}','${chat}','${viewer}','hello','story_reply')`)
  const rows = (await db.query("select * from notifications")).rows
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ user_id: owner, actor_id: viewer, chat_id: chat, read_at: null, type: "chat_message", title: "Story-ზე ახალი პასუხი", href: `/dashboard/chats/${chat}` })
  await db.exec(`insert into messages values('77777777-7777-4777-8777-777777777777',null,'${chat}','${viewer}','ordinary message','text')`)
  expect((await db.query("select * from notifications")).rows).toHaveLength(1)
})
