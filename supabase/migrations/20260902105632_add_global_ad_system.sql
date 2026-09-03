create table public.ads (
  id uuid primary key default gen_random_uuid(),
  placement_key text not null,
  title text,
  description text,
  image_url text,
  target_url text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  advertiser_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_placement_key_format check (placement_key ~ '^[a-z0-9_]{3,64}$'),
  constraint ads_title_length check (title is null or char_length(title) between 1 and 120),
  constraint ads_description_length check (description is null or char_length(description) <= 280),
  constraint ads_advertiser_name_length check (advertiser_name is null or char_length(advertiser_name) <= 120),
  constraint ads_image_url_length check (image_url is null or char_length(image_url) <= 2048),
  constraint ads_target_url_length check (target_url is null or char_length(target_url) <= 2048),
  constraint ads_schedule_order check (starts_at is null or ends_at is null or starts_at <= ends_at)
);

create index ads_active_placement_priority_idx
  on public.ads (placement_key, priority desc, created_at desc)
  where is_active;

create trigger set_ads_updated_at
before update on public.ads
for each row execute function public.set_updated_at();

alter table public.ads enable row level security;

create policy "public can read currently active ads"
on public.ads
for select
to anon, authenticated
using (
  is_active
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

revoke all on table public.ads from public, anon, authenticated;
grant select on table public.ads to anon, authenticated;

create table public.ad_events (
  id bigint generated always as identity primary key,
  ad_id uuid not null references public.ads(id) on delete cascade,
  placement_key text not null,
  event_type text not null,
  page_path text not null,
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  constraint ad_events_placement_key_format check (placement_key ~ '^[a-z0-9_]{3,64}$'),
  constraint ad_events_event_type check (event_type in ('impression', 'click')),
  constraint ad_events_page_path check (
    char_length(page_path) between 1 and 500
    and page_path like '/%'
    and page_path not like '//%'
  ),
  constraint ad_events_dedupe_key_length check (char_length(dedupe_key) = 64)
);

create index ad_events_ad_created_idx
  on public.ad_events (ad_id, created_at desc);

create index ad_events_placement_created_idx
  on public.ad_events (placement_key, created_at desc);

alter table public.ad_events enable row level security;

revoke all on table public.ad_events from public, anon, authenticated;
revoke all on sequence public.ad_events_id_seq from public, anon, authenticated;

comment on table public.ads is
  'First-party SamoSell advertising inventory. Client roles can only read ads that are active in their scheduled window.';

comment on table public.ad_events is
  'Server-written, deduplicated first-party impression and click events. No direct client access.';
