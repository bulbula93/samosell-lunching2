create extension if not exists pgcrypto;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.sizes (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  unique (group_name, label)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  city text,
  is_seller_verified boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  category_id bigint not null references public.categories (id),
  brand_id uuid references public.brands (id),
  size_id uuid references public.sizes (id),
  title text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'GEL',
  condition text not null default 'good' check (condition in ('new', 'like_new', 'good', 'fair')),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'active', 'reserved', 'sold', 'rejected', 'archived')),
  sale_type text not null default 'sell' check (sale_type in ('sell', 'exchange')),
  gender text not null default 'unisex' check (gender in ('women', 'men', 'unisex', 'kids')),
  color text,
  material text,
  city text,
  is_vip boolean not null default false,
  views_count integer not null default 0,
  favorites_count integer not null default 0,
  published_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (user_id, listing_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  unique (listing_id, buyer_id, seller_id),
  check (buyer_id <> seller_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamp with time zone not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_listings_updated_at on public.listings;
create trigger set_listings_updated_at
before update on public.listings
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.brands (name, slug)
values
  ('Zara', 'zara'),
  ('Nike', 'nike'),
  ('Levi''s', 'levis'),
  ('Adidas', 'adidas'),
  ('Mango', 'mango'),
  ('H&M', 'hm'),
  ('Guess', 'guess'),
  ('Prada', 'prada')
on conflict (slug) do nothing;

insert into public.sizes (group_name, label, sort_order)
values
  ('women', 'XS', 10),
  ('women', 'S', 20),
  ('women', 'M', 30),
  ('women', 'L', 40),
  ('women', 'XL', 50),
  ('men', 'S', 10),
  ('men', 'M', 20),
  ('men', 'L', 30),
  ('men', 'XL', 40),
  ('universal', 'One Size', 10),
  ('shoes', '36', 10),
  ('shoes', '37', 20),
  ('shoes', '38', 30),
  ('shoes', '39', 40),
  ('shoes', '40', 50),
  ('shoes', '41', 60),
  ('shoes', '42', 70),
  ('shoes', '43', 80)
on conflict (group_name, label) do nothing;

alter table public.brands enable row level security;
alter table public.sizes enable row level security;
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;

drop policy if exists "public can read brands" on public.brands;
create policy "public can read brands"
on public.brands
for select
to anon, authenticated
using (true);

drop policy if exists "public can read sizes" on public.sizes;
create policy "public can read sizes"
on public.sizes
for select
to anon, authenticated
using (true);

drop policy if exists "public can read profiles" on public.profiles;
create policy "public can read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "public can read active listings" on public.listings;
create policy "public can read active listings"
on public.listings
for select
to anon, authenticated
using (status = 'active');

drop policy if exists "users can read own listings" on public.listings;
create policy "users can read own listings"
on public.listings
for select
to authenticated
using (seller_id = auth.uid());

drop policy if exists "users can insert own listings" on public.listings;
create policy "users can insert own listings"
on public.listings
for insert
to authenticated
with check (seller_id = auth.uid());

drop policy if exists "users can update own listings" on public.listings;
create policy "users can update own listings"
on public.listings
for update
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

drop policy if exists "users can delete own listings" on public.listings;
create policy "users can delete own listings"
on public.listings
for delete
to authenticated
using (seller_id = auth.uid());

drop policy if exists "public can read images of active listings" on public.listing_images;
create policy "public can read images of active listings"
on public.listing_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings
    where public.listings.id = public.listing_images.listing_id
      and public.listings.status = 'active'
  )
);

drop policy if exists "users can read own listing images" on public.listing_images;
create policy "users can read own listing images"
on public.listing_images
for select
to authenticated
using (
  exists (
    select 1
    from public.listings
    where public.listings.id = public.listing_images.listing_id
      and public.listings.seller_id = auth.uid()
  )
);

drop policy if exists "users can insert own listing images" on public.listing_images;
create policy "users can insert own listing images"
on public.listing_images
for insert
to authenticated
with check (
  exists (
    select 1
    from public.listings
    where public.listings.id = public.listing_images.listing_id
      and public.listings.seller_id = auth.uid()
  )
);

drop policy if exists "users can update own listing images" on public.listing_images;
create policy "users can update own listing images"
on public.listing_images
for update
to authenticated
using (
  exists (
    select 1
    from public.listings
    where public.listings.id = public.listing_images.listing_id
      and public.listings.seller_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.listings
    where public.listings.id = public.listing_images.listing_id
      and public.listings.seller_id = auth.uid()
  )
);

drop policy if exists "users can delete own listing images" on public.listing_images;
create policy "users can delete own listing images"
on public.listing_images
for delete
to authenticated
using (
  exists (
    select 1
    from public.listings
    where public.listings.id = public.listing_images.listing_id
      and public.listings.seller_id = auth.uid()
  )
);

drop policy if exists "users can manage own favorites" on public.favorites;
create policy "users can manage own favorites"
on public.favorites
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "participants can read chats" on public.chats;
create policy "participants can read chats"
on public.chats
for select
to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "buyers can create chats for themselves" on public.chats;
create policy "buyers can create chats for themselves"
on public.chats
for insert
to authenticated
with check (buyer_id = auth.uid());

drop policy if exists "participants can update chats" on public.chats;
create policy "participants can update chats"
on public.chats
for update
to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid())
with check (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists "participants can read messages" on public.messages;
create policy "participants can read messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chats
    where public.chats.id = public.messages.chat_id
      and (public.chats.buyer_id = auth.uid() or public.chats.seller_id = auth.uid())
  )
);

drop policy if exists "participants can insert messages" on public.messages;
create policy "participants can insert messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chats
    where public.chats.id = public.messages.chat_id
      and (public.chats.buyer_id = auth.uid() or public.chats.seller_id = auth.uid())
  )
);

create or replace view public.listings_catalog
with (security_invoker = true) as
select
  l.id,
  l.slug,
  l.title,
  l.price,
  l.currency,
  l.condition,
  l.status,
  l.gender,
  l.city,
  l.is_vip,
  l.published_at,
  c.name as category_name,
  c.slug as category_slug,
  b.name as brand_name,
  s.label as size_label,
  p.username as seller_username,
  img.image_url as cover_image_url
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
