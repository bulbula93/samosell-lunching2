alter table public.listing_boost_products
  drop constraint if exists listing_boost_products_placement_check;

alter table public.listing_boost_products
  add constraint listing_boost_products_placement_check
  check (placement in ('vip', 'promoted', 'featured_home', 'banner_home', 'combo'));

insert into public.listing_boost_products (
  id,
  name,
  placement,
  duration_days,
  price,
  currency,
  description,
  is_active,
  sort_order
)
values (
  'home_banner_7d',
  'მთავარი გვერდის სარეკლამო ბანერი · 7 დღე',
  'banner_home',
  7,
  39.90,
  'GEL',
  'განცხადება 7 დღით გამოჩნდება SamoSell-ის მთავარი გვერდის დიდ სარეკლამო ბანერზე.',
  true,
  35
)
on conflict (id) do update
set
  name = excluded.name,
  placement = excluded.placement,
  duration_days = excluded.duration_days,
  price = excluded.price,
  currency = excluded.currency,
  description = excluded.description,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;
