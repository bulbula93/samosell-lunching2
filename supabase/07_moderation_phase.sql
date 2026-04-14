alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_suspended boolean not null default false;

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'fake', 'prohibited', 'abuse', 'wrong_info', 'other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  moderation_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  unique (listing_id, reporter_id)
);

create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker_id, created_at desc);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id);

create index if not exists listing_reports_status_created_at_idx
  on public.listing_reports (status, created_at desc);

create index if not exists listing_reports_listing_idx
  on public.listing_reports (listing_id);

create index if not exists listing_reports_reporter_idx
  on public.listing_reports (reporter_id, created_at desc);

alter table public.user_blocks enable row level security;
alter table public.listing_reports enable row level security;

drop policy if exists "users can manage own blocks" on public.user_blocks;
create policy "users can manage own blocks"
on public.user_blocks
for all
to authenticated
using (blocker_id = auth.uid())
with check (blocker_id = auth.uid());

drop policy if exists "users can create own reports" on public.listing_reports;
create policy "users can create own reports"
on public.listing_reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and reporter_id <> seller_id
  and exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.seller_id = seller_id
  )
);

drop policy if exists "users can read own reports" on public.listing_reports;
create policy "users can read own reports"
on public.listing_reports
for select
to authenticated
using (reporter_id = auth.uid());

drop policy if exists "admins can read all reports" on public.listing_reports;
create policy "admins can read all reports"
on public.listing_reports
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "admins can update reports" on public.listing_reports;
create policy "admins can update reports"
on public.listing_reports
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "admins can update any listing" on public.listings;
create policy "admins can update any listing"
on public.listings
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "admins can read all listings" on public.listings;
create policy "admins can read all listings"
on public.listings
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "admins can update profiles" on public.profiles;
create policy "admins can update profiles"
on public.profiles
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

create or replace view public.admin_listing_reports
with (security_invoker = true) as
select
  r.id,
  r.listing_id,
  r.reporter_id,
  r.seller_id,
  r.reason,
  r.details,
  r.status,
  r.moderation_note,
  r.reviewed_by,
  r.reviewed_at,
  r.created_at,
  l.slug as listing_slug,
  l.title as listing_title,
  l.status as listing_status,
  l.price,
  l.currency,
  l.cover_image_url,
  reporter.username as reporter_username,
  reporter.full_name as reporter_full_name,
  seller.username as seller_username,
  seller.full_name as seller_full_name,
  seller.is_suspended as seller_is_suspended
from public.listing_reports r
join public.listings l on l.id = r.listing_id
left join public.profiles reporter on reporter.id = r.reporter_id
left join public.profiles seller on seller.id = r.seller_id;

grant select on public.admin_listing_reports to authenticated;
