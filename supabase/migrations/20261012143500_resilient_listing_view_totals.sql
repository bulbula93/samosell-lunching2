-- Durable new-series listing view aggregates.
-- Legacy public.listings may contain historical data that violates newer CHECK
-- constraints. Changing only views_count still rechecks those constraints.
-- Count views in a dedicated table; never rewrite seller listing content.
create table if not exists public.listing_view_totals (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  measured_views bigint not null default 0 check(measured_views >= 0),
  first_measured_at timestamptz not null default now(),
  last_measured_at timestamptz not null default now()
);
alter table public.listing_view_totals enable row level security;
revoke all on public.listing_view_totals from public,anon,authenticated;
grant select,insert,update,delete on public.listing_view_totals to service_role;

create or replace function public.record_distinct_listing_view(
  p_listing_id uuid,
  p_viewer_hash text,
  p_network_hash text
)
returns boolean language plpgsql security invoker set search_path=''
as $$
declare
  v_minute_hits integer;
  v_listing_day_hits integer;
  v_minute_start timestamptz := date_trunc('minute', clock_timestamp());
  v_day_start timestamptz := date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC';
begin
  if p_listing_id is null or p_viewer_hash is null or p_viewer_hash !~ '^[0-9a-f]{64}$'
    or p_network_hash is null or p_network_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  if not exists(select 1 from public.listings where id=p_listing_id and status='active') then return false; end if;

  insert into public.listing_view_rate_windows(scope,rate_key,window_start,hits)
  values('minute',p_network_hash,v_minute_start,1)
  on conflict(scope,rate_key,window_start)
  do update set hits=public.listing_view_rate_windows.hits+1
  returning hits into v_minute_hits;
  if v_minute_hits > 60 then return false; end if;

  insert into public.listing_view_rate_windows(scope,rate_key,window_start,hits)
  values('listing_day',p_network_hash||':'||p_listing_id::text,v_day_start,1)
  on conflict(scope,rate_key,window_start)
  do update set hits=public.listing_view_rate_windows.hits+1
  returning hits into v_listing_day_hits;
  if v_listing_day_hits > 30 then return false; end if;

  insert into public.listing_view_daily(listing_id,viewer_hash,viewed_on)
  values(p_listing_id,p_viewer_hash,(now() at time zone 'UTC')::date)
  on conflict do nothing;
  if not found then return false; end if;

  insert into public.listing_view_totals(listing_id,measured_views,first_measured_at,last_measured_at)
  values(p_listing_id,1,clock_timestamp(),clock_timestamp())
  on conflict(listing_id) do update set
    measured_views=public.listing_view_totals.measured_views+1,
    last_measured_at=clock_timestamp();
  return true;
end;
$$;
revoke all on function public.record_distinct_listing_view(uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.record_distinct_listing_view(uuid,text,text)
  to service_role;
