-- IndexNow (Bing, Yandex, Seznam, Naver …): tell search engines about new/changed/removed listings.
-- Runs entirely in Postgres (pg_cron + pg_net) every 30 minutes — no Vercel execution.
-- The key is public by protocol design; it is served at https://samosell.ge/8ada49f461b715caefc3d59a7306a477.txt.
create table if not exists private.indexnow_state (
  id smallint primary key default 1 check (id = 1),
  last_run timestamptz not null,
  last_count integer not null default 0,
  last_request_id bigint
);
-- Start from now: pages submitted manually on 2026-11-07 are not re-sent.
insert into private.indexnow_state (id, last_run) values (1, now()) on conflict (id) do nothing;

create or replace function private.indexnow_ping()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_until timestamptz := now();
  v_urls jsonb;
  v_count integer;
  v_req bigint;
begin
  select last_run into v_since from private.indexnow_state where id = 1 for update;
  -- Only URLs that were ever public (active now, or published before and since removed/sold).
  select coalesce(jsonb_agg('https://samosell.ge/listing/' || slug), '[]'::jsonb), count(*)
    into v_urls, v_count
  from (
    select l.slug from public.listings l
    where l.updated_at > v_since and l.updated_at <= v_until
      and l.slug is not null
      and (l.status = 'active' or l.published_at is not null)
    order by l.updated_at
    limit 10000
  ) s;

  if v_count > 0 then
    select net.http_post(
      url := 'https://api.indexnow.org/indexnow',
      body := jsonb_build_object(
        'host', 'samosell.ge',
        'key', '8ada49f461b715caefc3d59a7306a477',
        'keyLocation', 'https://samosell.ge/8ada49f461b715caefc3d59a7306a477.txt',
        'urlList', v_urls
      ),
      headers := jsonb_build_object('Content-Type', 'application/json; charset=utf-8'),
      timeout_milliseconds := 10000
    ) into v_req;
  end if;

  update private.indexnow_state set last_run = v_until, last_count = v_count, last_request_id = coalesce(v_req, last_request_id) where id = 1;
  return v_count;
end;
$$;

revoke all on function private.indexnow_ping() from public, anon, authenticated;
revoke all on table private.indexnow_state from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'samosell-indexnow-ping';
select cron.schedule('samosell-indexnow-ping', '*/30 * * * *', $job$ select private.indexnow_ping(); $job$);
