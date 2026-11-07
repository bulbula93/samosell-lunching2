-- pg_net's http_post only accepts the exact header value 'application/json' (no extra parameters).
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
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 10000
    ) into v_req;
  end if;

  update private.indexnow_state set last_run = v_until, last_count = v_count, last_request_id = coalesce(v_req, last_request_id) where id = 1;
  return v_count;
end;
$$;

revoke all on function private.indexnow_ping() from public, anon, authenticated;
