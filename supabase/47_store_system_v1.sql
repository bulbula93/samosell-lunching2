-- Store System V1: explicit store identity and stable public storefront slug.
-- Existing individual sellers remain unchanged.

alter table public.profiles
  add column if not exists store_name text,
  add column if not exists store_slug text;

create unique index if not exists profiles_store_slug_unique_idx
  on public.profiles (lower(store_slug))
  where store_slug is not null;

alter table public.profiles
  drop constraint if exists profiles_store_slug_format_check;

alter table public.profiles
  add constraint profiles_store_slug_format_check
  check (
    store_slug is null
    or store_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  );

comment on column public.profiles.store_name is
  'Public business/store name. Used only when seller_type=store.';

comment on column public.profiles.store_slug is
  'Stable public storefront slug. Reserved for seller_type=store.';
