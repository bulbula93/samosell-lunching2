create table if not exists public.web_vitals_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  metric_name text not null check (metric_name in ('LCP','INP','CLS','FCP','TTFB')),
  metric_value double precision not null check (metric_value >= 0 and metric_value < 3600000),
  metric_rating text null check (metric_rating is null or metric_rating in ('good','needs-improvement','poor')),
  route_group text not null check (route_group in ('home','catalog','search','listing','other')),
  pathname text not null check (char_length(pathname) between 1 and 300)
);

alter table public.web_vitals_events enable row level security;

revoke all on table public.web_vitals_events from anon, authenticated;
grant insert, select, delete on table public.web_vitals_events to service_role;

create index if not exists web_vitals_events_route_metric_created_idx
  on public.web_vitals_events (route_group, metric_name, created_at desc);

create index if not exists web_vitals_events_created_at_idx
  on public.web_vitals_events (created_at desc);
