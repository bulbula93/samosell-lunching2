alter table public.listing_boost_orders
  add column if not exists checkout_session_started_at timestamp with time zone,
  add column if not exists last_payment_sync_at timestamp with time zone,
  add column if not exists paid_at timestamp with time zone,
  add column if not exists cancelled_at timestamp with time zone,
  add column if not exists failure_reason text;

update public.listing_boost_orders
set checkout_session_started_at = coalesce(checkout_session_started_at, created_at)
where payment_provider = 'tbc_checkout'
  and checkout_session_started_at is null;

create index if not exists idx_listing_boost_orders_payment_sync
  on public.listing_boost_orders (payment_provider, status, last_payment_sync_at desc);

create table if not exists public.listing_boost_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.listing_boost_orders (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('create', 'callback', 'return', 'manual_sync', 'admin', 'system')),
  event_type text not null check (event_type in ('checkout_created', 'callback_received', 'status_synced', 'payment_succeeded', 'payment_pending', 'payment_failed', 'boost_activated', 'boost_cancelled', 'note')),
  provider_status text,
  provider_result_code text,
  message text,
  payload jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_listing_boost_order_events_order_created
  on public.listing_boost_order_events (order_id, created_at desc);

create index if not exists idx_listing_boost_order_events_seller_created
  on public.listing_boost_order_events (seller_id, created_at desc);

alter table public.listing_boost_order_events enable row level security;

drop policy if exists "sellers can read own boost payment events" on public.listing_boost_order_events;
create policy "sellers can read own boost payment events"
on public.listing_boost_order_events
for select
to authenticated
using (seller_id = auth.uid());

drop policy if exists "admins can read all boost payment events" on public.listing_boost_order_events;
create policy "admins can read all boost payment events"
on public.listing_boost_order_events
for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
