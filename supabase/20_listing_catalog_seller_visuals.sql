create or replace view public.listings_catalog
with (security_invoker = true) as
select
  l.id,
  l.seller_id,
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
  case when l.is_vip = true and (l.vip_until is null or l.vip_until > now()) then true else false end as is_vip,
  case when l.promoted_until is not null and l.promoted_until > now() then true else false end as is_promoted,
  case when l.featured_until is not null and l.featured_until > now() then true else false end as is_featured,
  l.vip_until,
  l.promoted_until,
  l.featured_until,
  l.featured_slot,
  l.favorites_count,
  l.views_count,
  l.published_at,
  c.name as category_name,
  c.slug as category_slug,
  b.name as brand_name,
  s.label as size_label,
  p.username as seller_username,
  p.full_name as seller_full_name,
  p.created_at as seller_created_at,
  p.is_seller_verified as seller_is_verified,
  coalesce(l.cover_image_url, img.image_url) as cover_image_url,
  p.seller_type as seller_type,
  p.avatar_url as seller_avatar_url,
  p.store_logo_url as seller_store_logo_url
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
