alter table public.web_vitals_events
  add column if not exists device_class text,
  add column if not exists viewport_width integer,
  add column if not exists viewport_height integer,
  add column if not exists orientation text;

alter table public.web_vitals_events
  drop constraint if exists web_vitals_events_device_class_check,
  add constraint web_vitals_events_device_class_check
    check (device_class is null or device_class in ('phone','tablet','desktop')),
  drop constraint if exists web_vitals_events_orientation_check,
  add constraint web_vitals_events_orientation_check
    check (orientation is null or orientation in ('portrait','landscape'));

create index if not exists web_vitals_events_mobile_rollup_idx
  on public.web_vitals_events (device_class, route_group, metric_name, created_at desc);
