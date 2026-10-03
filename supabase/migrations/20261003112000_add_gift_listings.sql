begin;

alter table public.listings
  drop constraint if exists listings_sale_type_check;

alter table public.listings
  add constraint listings_sale_type_check
  check (sale_type in ('sell', 'exchange', 'gift'));

alter table public.listings
  drop constraint if exists listings_price_business_guard;

alter table public.listings
  add constraint listings_price_business_guard
  check (
    (sale_type = 'gift' and price = 0)
    or
    (
      sale_type <> 'gift'
      and price >= 0.01
      and price <= 99999999.99
      and price = round(price, 2)
    )
  );

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
  case
    when l.is_vip = true and l.vip_until > now() then true
    else false
  end as is_vip,
  case
    when l.promoted_until > now() then true
    else false
  end as is_promoted,
  case
    when l.featured_until > now() then true
    else false
  end as is_featured,
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
  p.seller_type,
  p.avatar_url as seller_avatar_url,
  p.store_logo_url as seller_store_logo_url,
  case
    when l.home_banner_until > now() then true
    else false
  end as is_home_banner,
  l.home_banner_until,
  l.home_banner_slot,
  case
    when l.featured_until > now() then 3
    when l.promoted_until > now() then 2
    when l.is_vip = true and l.vip_until > now() then 1
    else 0
  end as promotion_tier,
  l.public_id,
  l.sale_type
from public.listings l
join public.categories c on c.id = l.category_id
left join public.brands b on b.id = l.brand_id
left join public.sizes s on s.id = l.size_id
left join public.profiles p on p.id = l.seller_id
left join lateral (
  select listing_images.image_url
  from public.listing_images
  where listing_images.listing_id = l.id
  order by listing_images.sort_order, listing_images.created_at
  limit 1
) img on true;

grant select on public.listings_catalog to anon, authenticated;

commit;
