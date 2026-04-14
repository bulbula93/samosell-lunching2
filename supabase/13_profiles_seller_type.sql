alter table public.profiles
  add column if not exists seller_type text not null default 'individual'
  check (seller_type in ('individual', 'store'));

create index if not exists profiles_seller_type_idx
  on public.profiles (seller_type);
