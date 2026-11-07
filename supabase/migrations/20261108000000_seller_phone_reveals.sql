-- Counts successful "show phone number" clicks (aggregate analytics only).
-- No viewer identity, IP or user agent is stored.
create table if not exists public.seller_phone_reveals (
  id bigint generated always as identity primary key,
  listing_id uuid references public.listings(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('listing', 'seller_page')),
  created_at timestamptz not null default now()
);
alter table public.seller_phone_reveals enable row level security;
revoke all on public.seller_phone_reveals from public, anon, authenticated;
grant select, insert, delete on public.seller_phone_reveals to service_role;
create index if not exists seller_phone_reveals_created_idx on public.seller_phone_reveals(created_at);
create index if not exists seller_phone_reveals_seller_idx on public.seller_phone_reveals(seller_id, created_at);
