alter table public.listings
  add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public can view listing images" on storage.objects;
create policy "public can view listing images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'listing-images');

drop policy if exists "authenticated can upload own listing images" on storage.objects;
create policy "authenticated can upload own listing images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated can update own listing images" on storage.objects;
create policy "authenticated can update own listing images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated can delete own listing images" on storage.objects;
create policy "authenticated can delete own listing images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace view public.listings_catalog
with (security_invoker = true) as
select
  l.id,
  l.slug,
  l.title,
  l.description,
  l.price,
  l.currency,
  l.condition,
  l.status,
  l.gender,
  l.city,
  l.material,
  l.color,
  l.is_vip,
  l.published_at,
  c.name as category_name,
  c.slug as category_slug,
  b.name as brand_name,
  s.label as size_label,
  p.username as seller_username,
  p.full_name as seller_full_name,
  coalesce(l.cover_image_url, img.image_url) as cover_image_url
from public.listings l
join public.categories c on c.id = l.category_id
left join public.brands b on b.id = l.brand_id
left join public.sizes s on s.id = l.size_id
left join public.profiles p on p.id = l.seller_id
left join lateral (
  select image_url
  from public.listing_images
  where listing_id = l.id
  order by sort_order asc, created_at asc
  limit 1
) img on true;

grant select on public.listings_catalog to anon, authenticated;
