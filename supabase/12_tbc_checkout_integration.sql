alter table public.listing_boost_orders
  add column if not exists payment_provider text,
  add column if not exists provider_payment_id text,
  add column if not exists provider_checkout_url text,
  add column if not exists provider_status text,
  add column if not exists provider_result_code text;

update public.listing_boost_orders
set payment_provider = coalesce(payment_provider, case when payment_method = 'card_external' then 'external' else 'manual' end)
where payment_provider is null;

alter table public.listing_boost_orders
  drop constraint if exists listing_boost_orders_payment_method_check;

alter table public.listing_boost_orders
  add constraint listing_boost_orders_payment_method_check
  check (payment_method in ('bank_transfer', 'manual_cash', 'card_external', 'tbc_checkout'));

create unique index if not exists idx_listing_boost_orders_provider_payment_id
  on public.listing_boost_orders (provider_payment_id)
  where provider_payment_id is not null;

create index if not exists idx_listing_boost_orders_payment_provider_status
  on public.listing_boost_orders (payment_provider, provider_status, created_at desc);
