-- Count one consented listing detail view per browser fingerprint per UTC day.
-- Pseudonymous keyed digest is generated server-side; no raw IP or user-agent is persisted.
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

create or replace function public.record_distinct_listing_view(p_listing_id uuid, p_viewer_hash text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_listing_id is null or p_viewer_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  if not exists (select 1 from public.listings where id=p_listing_id and status='active') then return false; end if;
  insert into public.listing_view_daily(listing_id, viewer_hash, viewed_on)
    values (p_listing_id, p_viewer_hash, (now() at time zone 'UTC')::date)
    on conflict do nothing;
  if not found then return false; end if;
  update public.listings set views_count=coalesce(views_count,0)+1 where id=p_listing_id and status='active';
  return found;
end;
$$;
revoke all on function public.record_distinct_listing_view(uuid,text) from public, anon, authenticated;
grant execute on function public.record_distinct_listing_view(uuid,text) to service_role;
create index if not exists listing_view_daily_created_idx on public.listing_view_daily(created_at);
