insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-images',
  'ad-images',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ad images are public presentation assets, but uploads and mutations stay
-- service-role-only through the server-authorized admin workflow. No client
-- storage.objects policy is intentionally created for this bucket.

create or replace function public.get_admin_ad_event_counts_service(p_actor_id uuid)
returns table(ad_id uuid, impressions bigint, clicks bigint)
language sql
security definer
set search_path = ''
as $$
  select
    e.ad_id,
    count(*) filter (where e.event_type = 'impression')::bigint as impressions,
    count(*) filter (where e.event_type = 'click')::bigint as clicks
  from public.ad_events e
  where exists (
    select 1
    from public.profiles p
    where p.id = p_actor_id
      and p.is_admin = true
  )
  group by e.ad_id;
$$;

revoke all on function public.get_admin_ad_event_counts_service(uuid)
  from public, anon, authenticated;
grant execute on function public.get_admin_ad_event_counts_service(uuid)
  to service_role;
