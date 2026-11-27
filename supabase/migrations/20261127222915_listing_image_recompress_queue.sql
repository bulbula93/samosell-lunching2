-- One-off maintenance: shrink oversized listing photos (>1 MB) uploaded before
-- client-side compression existed. Originals are copied to a private backup
-- bucket by the edge function before being replaced in place (same path, so
-- listing URLs stay valid).
-- Applied 2026-11-28: 220 photos, 660 MB -> 75 MB, 0 failures.
create schema if not exists private;

create table if not exists private.listing_image_recompress (
  path text primary key,
  mimetype text not null,
  original_size bigint not null,
  new_size bigint,
  status text not null default 'pending' check (status in ('pending','processing','done','skipped','failed')),
  error text,
  attempts int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists private.listing_image_recompress_config (
  id int primary key check (id = 1),
  secret text not null
);

insert into private.listing_image_recompress_config (id, secret)
values (1, encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (id) do nothing;

insert into private.listing_image_recompress (path, mimetype, original_size)
select o.name, o.metadata->>'mimetype', (o.metadata->>'size')::bigint
from storage.objects o
where o.bucket_id = 'listing-images'
  and (o.metadata->>'size')::bigint > 1000000
  and o.metadata->>'mimetype' in ('image/jpeg','image/png')
on conflict (path) do nothing;

create or replace function public.claim_listing_image_recompress(p_secret text, p_limit int default 8)
returns table(path text, mimetype text, original_size bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret <> (select c.secret from private.listing_image_recompress_config c where c.id = 1) then
    raise exception 'invalid_secret';
  end if;
  return query
  update private.listing_image_recompress r
     set status = 'processing', attempts = r.attempts + 1, updated_at = now()
   where r.path in (
     select q.path from private.listing_image_recompress q
      where (q.status = 'pending' or (q.status = 'processing' and q.updated_at < now() - interval '10 minutes'))
        and q.attempts < 3
      order by q.original_size desc
      limit least(greatest(p_limit, 1), 20)
      for update skip locked)
  returning r.path, r.mimetype, r.original_size;
end $$;

create or replace function public.finish_listing_image_recompress(p_secret text, p_path text, p_status text, p_new_size bigint, p_error text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret <> (select c.secret from private.listing_image_recompress_config c where c.id = 1) then
    raise exception 'invalid_secret';
  end if;
  update private.listing_image_recompress
     set status = p_status, new_size = p_new_size, error = left(p_error, 500), updated_at = now()
   where path = p_path;
end $$;

create or replace function public.request_listing_image_recompress(p_limit int default 8)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  select net.http_post(
    url := 'https://lxsvjzbiuewgwpajqrwr.supabase.co/functions/v1/recompress-listing-images',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('secret', (select c.secret from private.listing_image_recompress_config c where c.id = 1), 'limit', p_limit),
    timeout_milliseconds := 150000
  ) into v_id;
  return v_id;
end $$;

revoke all on function public.claim_listing_image_recompress(text, int) from public, anon, authenticated;
revoke all on function public.finish_listing_image_recompress(text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.request_listing_image_recompress(int) from public, anon, authenticated;
grant execute on function public.claim_listing_image_recompress(text, int) to service_role;
grant execute on function public.finish_listing_image_recompress(text, text, text, bigint, text) to service_role;
