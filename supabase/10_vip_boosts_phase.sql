alter table public.listings
  add column if not exists vip_until timestamp with time zone,
  add column if not exists promoted_until timestamp with time zone,
  add column if not exists featured_until timestamp with time zone,
  add column if not exists featured_slot integer;

create table if not exists public.listing_boost_products (
  id text primary key,
  name text not null,
  placement text not null check (placement in ('vip', 'promoted', 'featured_home', 'combo')),
  duration_days integer not null check (duration_days > 0),
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'GEL',
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.listing_boost_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  product_id text not null references public.listing_boost_products (id),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'under_review', 'approved', 'active', 'expired', 'rejected', 'cancelled')),
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'manual_cash', 'card_external')),
  payment_reference text,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'GEL',
  notes text,
  admin_note text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  approved_at timestamp with time zone,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_listings_promoted_until on public.listings (promoted_until desc);
create index if not exists idx_listings_featured_until_slot on public.listings (featured_until desc, featured_slot asc);
create index if not exists idx_listing_boost_products_active_sort on public.listing_boost_products (is_active, sort_order asc);
create index if not exists idx_listing_boost_orders_seller_created_at on public.listing_boost_orders (seller_id, created_at desc);
create index if not exists idx_listing_boost_orders_status_created_at on public.listing_boost_orders (status, created_at desc);
create index if not exists idx_listing_boost_orders_listing_status on public.listing_boost_orders (listing_id, status);

drop trigger if exists set_listing_boost_orders_updated_at on public.listing_boost_orders;
create trigger set_listing_boost_orders_updated_at
before update on public.listing_boost_orders
for each row
execute function public.set_updated_at();

insert into public.listing_boost_products (id, name, placement, duration_days, price, currency, description, sort_order)
values
  ('vip_7d', 'VIP 7 დღე', 'vip', 7, 9.90, 'GEL', 'განცხადება გამოჩნდება VIP ბეჯით და VIP ფილტრებში.', 10),
  ('promoted_7d', 'Promoted 7 დღე', 'promoted', 7, 14.90, 'GEL', 'განცხადება აიწევს კატალოგში promoted წესით.', 20),
  ('featured_home_7d', 'Featured Home 7 დღე', 'featured_home', 7, 24.90, 'GEL', 'მთავარ გვერდზე და კატალოგში featured პოზიციებზე გამოვა.', 30),
  ('combo_7d', 'VIP + Featured 7 დღე', 'combo', 7, 34.90, 'GEL', 'ერთდროულად ააქტიურებს VIP, promoted და featured exposure-ს.', 40)
on conflict (id) do update
set name = excluded.name,
    placement = excluded.placement,
    duration_days = excluded.duration_days,
    price = excluded.price,
    currency = excluded.currency,
    description = excluded.description,
    is_active = true,
    sort_order = excluded.sort_order;

alter table public.listing_boost_products enable row level security;
alter table public.listing_boost_orders enable row level security;

drop policy if exists "public can read active boost products" on public.listing_boost_products;
create policy "public can read active boost products"
on public.listing_boost_products
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "admins can manage boost products" on public.listing_boost_products;
create policy "admins can manage boost products"
on public.listing_boost_products
for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "sellers can read own boost orders" on public.listing_boost_orders;
create policy "sellers can read own boost orders"
on public.listing_boost_orders
for select
to authenticated
using (seller_id = auth.uid());

drop policy if exists "sellers can create own boost orders" on public.listing_boost_orders;
create policy "sellers can create own boost orders"
on public.listing_boost_orders
for insert
to authenticated
with check (
  seller_id = auth.uid()
  and exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid()
  )
);

drop policy if exists "admins can read all boost orders" on public.listing_boost_orders;
create policy "admins can read all boost orders"
on public.listing_boost_orders
for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

drop policy if exists "admins can update boost orders" on public.listing_boost_orders;
create policy "admins can update boost orders"
on public.listing_boost_orders
for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

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
