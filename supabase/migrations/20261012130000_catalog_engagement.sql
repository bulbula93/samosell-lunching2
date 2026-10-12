-- Consent-gated catalog viewport impressions and primary-card clicks.
-- Raw client network identifiers are never stored. Privileged RPC only.
create table if not exists public.catalog_engagement_events (
  event_key text primary key check (event_key ~ '^[0-9a-f]{64}$'),
  listing_id uuid not null references public.listings(id) on delete cascade,
  event_kind text not null check (event_kind in ('impression','click')),
  page_hash text not null check (page_hash ~ '^[0-9a-f]{64}$'),
  position smallint not null check (position between 1 and 100),
  occurred_at timestamptz not null default now()
);
create index if not exists catalog_engagement_listing_time_idx on public.catalog_engagement_events(listing_id,occurred_at desc);
create index if not exists catalog_engagement_time_idx on public.catalog_engagement_events(occurred_at);
alter table public.catalog_engagement_events enable row level security;
revoke all on public.catalog_engagement_events from public, anon, authenticated;
grant select, insert, delete on public.catalog_engagement_events to service_role;

create table if not exists public.catalog_engagement_rate_windows (
  network_hash text not null check (network_hash ~ '^[0-9a-f]{64}$'),
  window_minute timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (network_hash,window_minute)
);
create index if not exists catalog_engagement_rate_windows_time_idx on public.catalog_engagement_rate_windows(window_minute);
alter table public.catalog_engagement_rate_windows enable row level security;
revoke all on public.catalog_engagement_rate_windows from public, anon, authenticated;
grant select,insert,update,delete on public.catalog_engagement_rate_windows to service_role;

create or replace function public.record_catalog_engagement(
  p_items jsonb, p_page_hash text, p_network_hash text
) returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_event jsonb;
  v_listing_id uuid;
  v_event_key text;
  v_kind text;
  v_position integer;
  v_count integer := 0;
  v_hits integer;
  v_length integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return 0; end if;
  v_length := jsonb_array_length(p_items);
  if v_length < 1 or v_length > 20 then return 0; end if;
  if p_page_hash is null or p_page_hash !~ '^[0-9a-f]{64}$'
    or p_network_hash is null or p_network_hash !~ '^[0-9a-f]{64}$' then return 0; end if;
  -- Atomic 240-events/minute per trusted network, across changed client page IDs.
  insert into public.catalog_engagement_rate_windows(network_hash,window_minute,hits)
  values (p_network_hash,date_trunc('minute',clock_timestamp()),v_length)
  on conflict(network_hash,window_minute)
  do update set hits=public.catalog_engagement_rate_windows.hits+excluded.hits
  returning hits into v_hits;
  if v_hits > 240 then return 0; end if;

  for v_event in select value from jsonb_array_elements(p_items)
  loop
    v_event_key := v_event->>'event_key';
    v_kind := v_event->>'event_kind';
    if v_event_key is null or v_event_key !~ '^[0-9a-f]{64}$'
      or v_kind not in ('impression','click')
      or (v_event->>'listing_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (v_event->>'position') !~ '^[0-9]{1,3}$'
    then continue; end if;
    v_position := (v_event->>'position')::integer;
    if v_position < 1 or v_position > 100 then continue; end if;
    v_listing_id := (v_event->>'listing_id')::uuid;
    if not exists (select 1 from public.listings where id=v_listing_id and status='active') then continue; end if;
    insert into public.catalog_engagement_events(event_key,listing_id,event_kind,page_hash,position)
    values (v_event_key,v_listing_id,v_kind,p_page_hash,v_position)
    on conflict do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.record_catalog_engagement(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.record_catalog_engagement(jsonb,text,text) to service_role;

-- Service-role-only maintenance; never scheduled until release approval.
create or replace function public.prune_catalog_engagement()
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  delete from public.catalog_engagement_events where occurred_at < now()-interval '35 days';
  delete from public.catalog_engagement_rate_windows where window_minute < now()-interval '2 days';
end;
$$;
revoke all on function public.prune_catalog_engagement() from public,anon,authenticated;
grant execute on function public.prune_catalog_engagement() to service_role;
