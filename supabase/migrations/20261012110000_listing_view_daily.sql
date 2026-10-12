-- Privacy-preserving daily listing view counts and atomic network rate limits.
-- Never persist raw IP addresses or user agents. All digests are server-keyed.
create table if not exists public.listing_view_daily (
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewer_hash text not null check (viewer_hash ~ '^[0-9a-f]{64}$'),
  viewed_on date not null default (now() at time zone 'UTC')::date,
  created_at timestamptz not null default now(),
  primary key (listing_id, viewer_hash, viewed_on)
);
alter table public.listing_view_daily enable row level security;
revoke all on public.listing_view_daily from public, anon, authenticated;
grant select, insert, delete on public.listing_view_daily to service_role;

-- Rate limiting is independent of the browser cookie: clearing it cannot bypass a network quota.
-- Keep all keys hashed, with no sensitive client identifiers exposed to browser roles.
create table if not exists public.listing_view_rate_windows (
  scope text not null check (scope in ('minute', 'listing_day')),
  rate_key text not null check (length(rate_key) between 64 and 101),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (scope, rate_key, window_start)
);
alter table public.listing_view_rate_windows enable row level security;
revoke all on public.listing_view_rate_windows from public, anon, authenticated;
grant select, insert, update, delete on public.listing_view_rate_windows to service_role;
create index if not exists listing_view_rate_windows_age_idx on public.listing_view_rate_windows(window_start);

create or replace function public.record_distinct_listing_view(
  p_listing_id uuid,
  p_viewer_hash text,
  p_network_hash text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_minute_hits integer;
  v_listing_day_hits integer;
  v_minute_start timestamptz := date_trunc('minute', clock_timestamp());
  v_day_start timestamptz := date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC';
begin
  if p_listing_id is null or p_viewer_hash is null or p_viewer_hash !~ '^[0-9a-f]{64}$'
      or p_network_hash is null or p_network_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  if not exists (select 1 from public.listings where id=p_listing_id and status='active') then
    return false;
  end if;

  -- PostgreSQL UPSERT serializes competing writes to the same window.
  -- 60 requests/min/network and 30 requests/day/network/listing.
  insert into public.listing_view_rate_windows (scope, rate_key, window_start, hits)
  values ('minute', p_network_hash, v_minute_start, 1)
  on conflict (scope, rate_key, window_start)
  do update set hits = public.listing_view_rate_windows.hits + 1
  returning hits into v_minute_hits;
  if v_minute_hits > 60 then return false; end if;

  insert into public.listing_view_rate_windows (scope, rate_key, window_start, hits)
  values ('listing_day', p_network_hash || ':' || p_listing_id::text, v_day_start, 1)
  on conflict (scope, rate_key, window_start)
  do update set hits = public.listing_view_rate_windows.hits + 1
  returning hits into v_listing_day_hits;
  if v_listing_day_hits > 30 then return false; end if;

  insert into public.listing_view_daily(listing_id, viewer_hash, viewed_on)
  values (p_listing_id, p_viewer_hash, (now() at time zone 'UTC')::date)
  on conflict do nothing;
  if not found then return false; end if;
  update public.listings set views_count=coalesce(views_count,0)+1
  where id=p_listing_id and status='active';
  return found;
end;
$$;
revoke all on function public.record_distinct_listing_view(uuid,text,text) from public, anon, authenticated;
grant execute on function public.record_distinct_listing_view(uuid,text,text) to service_role;

create index if not exists listing_view_daily_created_idx on public.listing_view_daily(created_at);

-- Retention: background housekeeping can remove expired rate buckets (> 2 days)
-- and old deduplication rows (> 35 days); the aggregate views_count remains intact.
