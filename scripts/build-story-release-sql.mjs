// Generates a reviewed artifact only. Never connects to any database.
import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"

const migrations = [
  ["20260908072522_add_stories_following_v1", "to_regclass('public.stories') is not null and to_regprocedure('public.reply_to_story(uuid,text,uuid)') is not null"],
  ["20260909103246_harden_stories_review", "exists(select 1 from storage.buckets where id='story-media' and public=false) and exists(select 1 from pg_trigger where tgname='guard_story_storage_write' and tgrelid='storage.objects'::regclass)"],
  ["20260910161733_story_likes_and_reply_notifications", "to_regprocedure('public.set_story_liked(uuid,boolean)') is not null and exists(select 1 from pg_trigger where tgname='messages_notify_story_reply' and tgrelid='public.messages'::regclass)"],
  ["20260910162000_fix_story_public_read_rls", "exists(select 1 from pg_policies where schemaname='public' and tablename='stories' and policyname='anonymous can read active stories') and exists(select 1 from pg_policies where schemaname='public' and tablename='stories' and policyname='authenticated can read active stories')"],
  ["20260911061418_separate_chat_notification_read_state", "position('chat_message' in pg_get_functiondef('public.mark_all_notifications_read()'::regprocedure))>0"],
  ["20260911061933_open_profile_direct_chat", "to_regprocedure('public.open_profile_direct_chat(uuid)') is not null"],
  ["20260911064423_harden_story_cleanup_retention", "to_regprocedure('public.prune_unpublished_story_upload_plans(integer)') is not null and not has_function_privilege('anon','public.prune_unpublished_story_upload_plans(integer)','EXECUTE') and not has_function_privilege('authenticated','public.list_expired_story_media_for_cleanup(integer)','EXECUTE')"],
]
const quote = (value) => `'${value.replaceAll("'", "''")}'`
const versions = migrations.map(([name])=>quote(name.slice(0,14))).join(",")
let sql = `-- REVIEW BEFORE EXECUTION. Intended project: lxsvjzbiuewgwpajqrwr.
-- Verify connection identity outside SQL using the Supabase Connect panel.
-- All-missing state only; unexpected existing/partial state fails closed.
begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
do $preflight$
declare v_name text;
begin
  if exists(select 1 from supabase_migrations.schema_migrations where version in (${versions})) then
    raise exception 'Story migration history already exists: inspect partial state; do not reapply';
  end if;
  foreach v_name in array array['user_follows','stories','story_views','story_mutes','story_listing_clicks','story_reports','story_upload_plans','story_likes','admin_story_reports'] loop
    if to_regclass('public.'||v_name) is not null then raise exception 'Unexpected Story object: %',v_name; end if;
  end loop;
  if exists(select 1 from storage.buckets where id='story-media') then raise exception 'Unexpected existing Story bucket'; end if;
  foreach v_name in array array['profiles','listings','listing_images','chats','messages','notifications','user_blocks','user_action_rate_limits','moderation_audit_log'] loop
    if to_regclass('public.'||v_name) is null then raise exception 'Missing prerequisite: %',v_name; end if;
  end loop;
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then raise exception 'Missing Realtime publication'; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then raise exception 'Messages missing from Realtime'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal) then raise exception 'Verify Auth profile bootstrap trigger'; end if;
end;
$preflight$;
`
for (const [name, assertion] of migrations) {
  const source = readFileSync(`supabase/migrations/${name}.sql`, "utf8")
  const hash = createHash("sha256").update(source).digest("hex")
  sql += `\n-- ${name}.sql SHA256 ${hash}\n${source}\n`
  sql += `do $verify$ begin if not (${assertion}) then raise exception 'Verification failed: ${name}'; end if; end $verify$;\n`
  sql += `insert into supabase_migrations.schema_migrations(version,name,statements) values (${quote(name.slice(0,14))},${quote(name.slice(15))},array[${quote(source)}]);\n`
}
sql += `
do $verify$ begin
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('stories','story_views','story_mutes','story_listing_clicks','story_reports','story_upload_plans','story_likes','user_follows') and not c.relrowsecurity) then raise exception 'Story RLS missing'; end if;
  if has_table_privilege('authenticated','public.story_upload_plans','INSERT') then raise exception 'Unexpected client plan write'; end if;
end $verify$;
commit;
select version,name from supabase_migrations.schema_migrations where version in (${versions}) order by version;
`
writeFileSync("story-release.sql",sql,{flag:"wx"})
console.log("Created story-release.sql with seven allowlisted migrations; no database was contacted.")
