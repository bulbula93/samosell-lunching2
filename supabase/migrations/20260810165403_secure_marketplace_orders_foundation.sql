-- Phase 8: secure, payment-provider-neutral marketplace order foundation.
--
-- This migration intentionally does not expose an order-creation RPC. A future
-- payment/settlement adapter must create the order from server-derived listing
-- data and reserve the listing atomically. Authenticated clients can only read
-- their own orders and request narrowly-scoped participant transitions.

create table public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  buyer_id uuid references public.profiles (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending_payment'
    check (status in (
      'pending_payment',
      'paid',
      'seller_confirmed',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
      'disputed',
      'refunded'
    )),
  listing_title text not null check (char_length(btrim(listing_title)) between 1 and 160),
  listing_slug text not null check (char_length(btrim(listing_slug)) between 1 and 220),
  listing_cover_image_url text,
  item_price numeric(10, 2) not null check (item_price > 0),
  delivery_price numeric(10, 2) not null check (delivery_price >= 0),
  platform_fee numeric(10, 2) not null check (platform_fee >= 0),
  buyer_protection_fee numeric(10, 2) not null check (buyer_protection_fee >= 0),
  total_amount numeric(10, 2) generated always as (
    item_price + delivery_price + platform_fee + buyer_protection_fee
  ) stored,
  currency text not null default 'GEL' check (currency = 'GEL'),
  delivery_method text check (
    delivery_method is null
    or char_length(btrim(delivery_method)) between 1 and 50
  ),
  payment_provider text check (
    payment_provider is null
    or char_length(btrim(payment_provider)) between 1 and 50
  ),
  provider_payment_id text,
  provider_status text,
  paid_at timestamp with time zone,
  seller_confirmed_at timestamp with time zone,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  disputed_at timestamp with time zone,
  refunded_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  check (buyer_id is null or seller_id is null or buyer_id <> seller_id)
);

comment on table public.marketplace_orders is
  'Participant-readable marketplace order snapshots. Creation and payment transitions are reserved for trusted server/provider code.';
comment on column public.marketplace_orders.delivery_method is
  'Provider-owned delivery method identifier. No public delivery values are enabled by this migration.';

create unique index marketplace_orders_provider_payment_unique
  on public.marketplace_orders (payment_provider, provider_payment_id)
  where payment_provider is not null and provider_payment_id is not null;

create index marketplace_orders_buyer_created_idx
  on public.marketplace_orders (buyer_id, created_at desc);

create index marketplace_orders_seller_created_idx
  on public.marketplace_orders (seller_id, created_at desc);

create index marketplace_orders_listing_created_idx
  on public.marketplace_orders (listing_id, created_at desc);

create trigger set_marketplace_orders_updated_at
before update on public.marketplace_orders
for each row execute function public.set_updated_at();

create table public.marketplace_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.marketplace_orders (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text not null check (actor_role in ('buyer', 'seller', 'provider', 'system', 'admin')),
  event_type text not null check (event_type in ('status_changed', 'payment_synced', 'note')),
  from_status text,
  to_status text,
  created_at timestamp with time zone not null default now()
);

create index marketplace_order_events_order_created_idx
  on public.marketplace_order_events (order_id, created_at desc);

create index marketplace_order_events_actor_idx
  on public.marketplace_order_events (actor_id)
  where actor_id is not null;

alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_events enable row level security;

create policy "participants can read own marketplace orders"
on public.marketplace_orders
for select
to authenticated
using (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
);

create policy "participants can read own marketplace order events"
on public.marketplace_order_events
for select
to authenticated
using (
  exists (
    select 1
    from public.marketplace_orders order_row
    where order_row.id = marketplace_order_events.order_id
      and (
        order_row.buyer_id = (select auth.uid())
        or order_row.seller_id = (select auth.uid())
      )
  )
);

revoke all on table public.marketplace_orders from public, anon, authenticated;
revoke all on table public.marketplace_order_events from public, anon, authenticated;
revoke all on sequence public.marketplace_order_events_id_seq from public, anon, authenticated;

grant select on table public.marketplace_orders to authenticated;
grant select on table public.marketplace_order_events to authenticated;

grant all on table public.marketplace_orders to service_role;
grant all on table public.marketplace_order_events to service_role;
grant usage, select on sequence public.marketplace_order_events_id_seq to service_role;

create or replace function public.transition_marketplace_order(
  p_order_id uuid,
  p_next_status text,
  p_expected_updated_at timestamp with time zone
)
returns table (
  order_id uuid,
  status text,
  updated_at timestamp with time zone,
  listing_slug text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_order public.marketplace_orders%rowtype;
  v_now timestamp with time zone := now();
  v_allowed boolean := false;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if p_order_id is null
    or p_expected_updated_at is null
    or p_next_status not in (
      'pending_payment',
      'paid',
      'seller_confirmed',
      'shipped',
      'delivered',
      'completed',
      'cancelled',
      'disputed',
      'refunded'
    ) then
    raise exception using errcode = '22023', message = 'invalid_order_transition';
  end if;

  select order_row.*
  into v_order
  from public.marketplace_orders order_row
  where order_row.id = p_order_id
    and (order_row.buyer_id = v_actor_id or order_row.seller_id = v_actor_id)
  for update;

  if not found then
    return;
  end if;

  if v_order.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'stale_order';
  end if;

  if v_order.buyer_id = v_actor_id then
    v_actor_role := 'buyer';
    v_allowed :=
      (v_order.status = 'pending_payment' and p_next_status = 'cancelled')
      or (v_order.status = 'shipped' and p_next_status = 'delivered')
      or (v_order.status = 'delivered' and p_next_status = 'completed')
      or (
        v_order.status in ('paid', 'seller_confirmed', 'shipped', 'delivered')
        and p_next_status = 'disputed'
      );
  elsif v_order.seller_id = v_actor_id then
    v_actor_role := 'seller';
    v_allowed :=
      (v_order.status = 'pending_payment' and p_next_status = 'cancelled')
      or (v_order.status = 'paid' and p_next_status = 'seller_confirmed')
      or (v_order.status = 'seller_confirmed' and p_next_status = 'shipped');
  end if;

  if not v_allowed then
    raise exception using errcode = '22023', message = 'invalid_order_transition';
  end if;

  update public.marketplace_orders order_row
  set
    status = p_next_status,
    seller_confirmed_at = case
      when p_next_status = 'seller_confirmed' then coalesce(order_row.seller_confirmed_at, v_now)
      else order_row.seller_confirmed_at
    end,
    shipped_at = case
      when p_next_status = 'shipped' then coalesce(order_row.shipped_at, v_now)
      else order_row.shipped_at
    end,
    delivered_at = case
      when p_next_status = 'delivered' then coalesce(order_row.delivered_at, v_now)
      else order_row.delivered_at
    end,
    completed_at = case
      when p_next_status = 'completed' then coalesce(order_row.completed_at, v_now)
      else order_row.completed_at
    end,
    cancelled_at = case
      when p_next_status = 'cancelled' then coalesce(order_row.cancelled_at, v_now)
      else order_row.cancelled_at
    end,
    disputed_at = case
      when p_next_status = 'disputed' then coalesce(order_row.disputed_at, v_now)
      else order_row.disputed_at
    end
  where order_row.id = v_order.id
  returning order_row.updated_at into v_order.updated_at;

  insert into public.marketplace_order_events (
    order_id,
    actor_id,
    actor_role,
    event_type,
    from_status,
    to_status
  )
  values (
    v_order.id,
    v_actor_id,
    v_actor_role,
    'status_changed',
    v_order.status,
    p_next_status
  );

  return query
    select v_order.id, p_next_status, v_order.updated_at, v_order.listing_slug;
end;
$$;

revoke all on function public.transition_marketplace_order(uuid, text, timestamp with time zone)
  from public, anon;
grant execute on function public.transition_marketplace_order(uuid, text, timestamp with time zone)
  to authenticated;

-- Extend the existing database-backed rate limiter with the exact order rule
-- used by the server action. Callers still cannot weaken any configured rule.
create or replace function public.consume_action_rate_limit(
  p_action text,
  p_window_seconds integer,
  p_max_hits integer
)
returns table (
  allowed boolean,
  current_count integer,
  limit_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamp with time zone := now();
  v_row public.user_action_rate_limits%rowtype;
  v_reset_at timestamp with time zone;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not (
    (p_action = 'listing_create' and p_window_seconds = 3600 and p_max_hits = 12)
    or (p_action = 'listing_upload' and p_window_seconds = 3600 and p_max_hits = 60)
    or (p_action = 'listing_status_update' and p_window_seconds = 600 and p_max_hits = 30)
    or (p_action = 'order_status_update' and p_window_seconds = 600 and p_max_hits = 30)
    or (p_action = 'chat_start' and p_window_seconds = 600 and p_max_hits = 20)
    or (p_action = 'chat_message' and p_window_seconds = 60 and p_max_hits = 20)
    or (p_action = 'listing_report' and p_window_seconds = 3600 and p_max_hits = 10)
  ) then
    raise exception using errcode = 'P0001', message = 'bad_rate_limit_arguments';
  end if;

  insert into public.user_action_rate_limits (
    user_id,
    action,
    window_started_at,
    hits
  )
  values (
    v_user_id,
    p_action,
    v_now,
    0
  )
  on conflict (user_id, action) do nothing;

  select *
  into v_row
  from public.user_action_rate_limits
  where user_id = v_user_id
    and action = p_action
  for update;

  v_reset_at := v_row.window_started_at + make_interval(secs => p_window_seconds);

  if v_now >= v_reset_at then
    update public.user_action_rate_limits
    set window_started_at = v_now, hits = 1
    where user_id = v_user_id and action = p_action;

    return query select true, 1, p_max_hits, 0;
    return;
  end if;

  if v_row.hits < p_max_hits then
    update public.user_action_rate_limits
    set hits = v_row.hits + 1
    where user_id = v_user_id and action = p_action;

    return query
      select
        true,
        v_row.hits + 1,
        p_max_hits,
        greatest(0, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
    return;
  end if;

  return query
    select
      false,
      v_row.hits,
      p_max_hits,
      greatest(0, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
end;
$$;

revoke all on function public.consume_action_rate_limit(text, integer, integer)
  from public, anon;
grant execute on function public.consume_action_rate_limit(text, integer, integer)
  to authenticated;
