create schema if not exists private;

alter table public.listing_boost_orders
  add column if not exists checkout_session_started_at timestamp with time zone,
  add column if not exists last_payment_sync_at timestamp with time zone,
  add column if not exists paid_at timestamp with time zone,
  add column if not exists cancelled_at timestamp with time zone,
  add column if not exists failure_reason text,
  add column if not exists placement_slot integer;

update public.listing_boost_orders
set checkout_session_started_at = coalesce(checkout_session_started_at, created_at)
where payment_provider = 'tbc_checkout'
  and checkout_session_started_at is null;

create index if not exists idx_listing_boost_orders_payment_sync
  on public.listing_boost_orders (payment_provider, status, last_payment_sync_at desc);

create unique index if not exists idx_listing_boost_orders_one_pending_package
  on public.listing_boost_orders (listing_id, seller_id, product_id)
  where status in ('pending_payment', 'under_review', 'approved');

create table if not exists public.listing_boost_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.listing_boost_orders (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  source text not null,
  event_type text not null,
  provider_status text,
  provider_result_code text,
  message text,
  payload jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.listing_boost_order_events
  drop constraint if exists listing_boost_order_events_source_check,
  drop constraint if exists listing_boost_order_events_event_type_check;

alter table public.listing_boost_order_events
  add constraint listing_boost_order_events_source_check
    check (source in ('create', 'callback', 'return', 'manual_sync', 'admin', 'system')),
  add constraint listing_boost_order_events_event_type_check
    check (event_type in (
      'checkout_created',
      'callback_received',
      'status_synced',
      'payment_succeeded',
      'payment_pending',
      'payment_failed',
      'boost_activated',
      'boost_expired',
      'boost_cancelled',
      'note'
    ));

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
using ((select auth.uid()) = seller_id);

drop policy if exists "admins can read all boost payment events" on public.listing_boost_order_events;
create policy "admins can read all boost payment events"
on public.listing_boost_order_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_admin = true
  )
);

revoke all on table public.listing_boost_order_events from anon;
revoke insert, update, delete, truncate on table public.listing_boost_order_events from authenticated;
grant select on table public.listing_boost_order_events to authenticated;
grant all on table public.listing_boost_order_events to service_role;
grant usage, select on sequence public.listing_boost_order_events_id_seq to service_role;

update public.listing_boost_products
set
  name = case id
    when 'vip_7d' then 'VIP'
    when 'promoted_7d' then 'TOP'
    when 'combo_7d' then 'VIP MAX'
    when 'home_banner_7d' then 'მთავარი გვერდის ბანერი'
    else name
  end,
  description = case id
    when 'vip_7d' then 'VIP ბეჯი, მთავარი გვერდის VIP სივრცე და მეტი ხილვადობა.'
    when 'promoted_7d' then 'განცხადება უფრო მაღლა გამოჩნდება კატალოგსა და ძებნაში.'
    when 'combo_7d' then 'VIP, TOP და მთავარი გვერდის გამორჩეული პოზიცია ერთ პაკეტში.'
    when 'home_banner_7d' then 'განცხადება გამოჩნდება მთავარი გვერდის დიდ სარეკლამო ბანერზე.'
    else description
  end,
  duration_days = case when id in ('vip_7d', 'promoted_7d', 'combo_7d', 'home_banner_7d') then 7 else duration_days end,
  price = case id
    when 'vip_7d' then 9.90
    when 'promoted_7d' then 14.90
    when 'combo_7d' then 34.90
    when 'home_banner_7d' then 39.90
    else price
  end,
  currency = case when id in ('vip_7d', 'promoted_7d', 'combo_7d', 'home_banner_7d') then 'GEL' else currency end,
  is_active = case
    when id in ('vip_7d', 'promoted_7d', 'combo_7d', 'home_banner_7d') then true
    when id = 'featured_home_7d' then false
    else is_active
  end,
  sort_order = case id
    when 'vip_7d' then 10
    when 'promoted_7d' then 20
    when 'combo_7d' then 30
    when 'home_banner_7d' then 40
    when 'featured_home_7d' then 90
    else sort_order
  end
where id in ('vip_7d', 'promoted_7d', 'featured_home_7d', 'combo_7d', 'home_banner_7d');

drop policy if exists "sellers can read products from own boost orders" on public.listing_boost_products;
create policy "sellers can read products from own boost orders"
on public.listing_boost_products
for select
to authenticated
using (
  exists (
    select 1
    from public.listing_boost_orders o
    where o.product_id = listing_boost_products.id
      and o.seller_id = (select auth.uid())
  )
);

create or replace function private.protect_listing_promotion_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if new.is_vip is distinct from old.is_vip
    or new.vip_until is distinct from old.vip_until
    or new.promoted_until is distinct from old.promoted_until
    or new.featured_until is distinct from old.featured_until
    or new.featured_slot is distinct from old.featured_slot
    or new.home_banner_until is distinct from old.home_banner_until
    or new.home_banner_slot is distinct from old.home_banner_slot then
    raise exception 'Promotion fields can only be changed by trusted boost activation logic.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_listing_promotion_fields() from public, anon, authenticated;

drop trigger if exists protect_listing_promotion_fields on public.listings;
create trigger protect_listing_promotion_fields
before update on public.listings
for each row
execute function private.protect_listing_promotion_fields();

create or replace function private.reconcile_listing_boost_state(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vip_until timestamp with time zone;
  v_promoted_until timestamp with time zone;
  v_featured_until timestamp with time zone;
  v_banner_until timestamp with time zone;
  v_featured_slot integer;
  v_banner_slot integer;
begin
  select
    max(o.ends_at) filter (where p.placement in ('vip', 'combo')),
    max(o.ends_at) filter (where p.placement in ('promoted', 'combo')),
    max(o.ends_at) filter (where p.placement in ('featured_home', 'combo')),
    max(o.ends_at) filter (where p.placement = 'banner_home'),
    (array_agg(o.placement_slot order by o.ends_at desc) filter (
      where p.placement in ('featured_home', 'combo') and o.placement_slot is not null
    ))[1],
    (array_agg(o.placement_slot order by o.ends_at desc) filter (
      where p.placement = 'banner_home' and o.placement_slot is not null
    ))[1]
  into
    v_vip_until,
    v_promoted_until,
    v_featured_until,
    v_banner_until,
    v_featured_slot,
    v_banner_slot
  from public.listing_boost_orders o
  join public.listing_boost_products p on p.id = o.product_id
  join public.listings l on l.id = o.listing_id and l.seller_id = o.seller_id
  where o.listing_id = p_listing_id
    and o.status = 'active'
    and o.ends_at > now();

  update public.listings
  set
    is_vip = v_vip_until is not null,
    vip_until = v_vip_until,
    promoted_until = v_promoted_until,
    featured_until = v_featured_until,
    featured_slot = case when v_featured_until is null then null else coalesce(v_featured_slot, featured_slot, 1) end,
    home_banner_until = v_banner_until,
    home_banner_slot = case when v_banner_until is null then null else coalesce(v_banner_slot, home_banner_slot, 1) end
  where id = p_listing_id;
end;
$$;

revoke all on function private.reconcile_listing_boost_state(uuid) from public, anon, authenticated;

create or replace function public.activate_listing_boost_order(
  p_order_id uuid,
  p_reviewed_by uuid default null,
  p_featured_slot integer default null,
  p_activation_source text default 'system'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.listing_boost_orders%rowtype;
  v_listing public.listings%rowtype;
  v_product public.listing_boost_products%rowtype;
  v_now timestamp with time zone := now();
  v_anchor timestamp with time zone;
  v_ends_at timestamp with time zone;
  v_slot integer;
begin
  select * into v_order
  from public.listing_boost_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Boost order not found.' using errcode = 'P0002';
  end if;

  select * into v_listing
  from public.listings
  where id = v_order.listing_id
  for update;

  if not found or v_listing.seller_id <> v_order.seller_id then
    raise exception 'Boost order ownership does not match the listing.' using errcode = '42501';
  end if;

  select * into v_product
  from public.listing_boost_products
  where id = v_order.product_id;

  if not found or v_product.duration_days <= 0 then
    raise exception 'Boost product is invalid.' using errcode = '22023';
  end if;

  if v_order.status = 'active' and v_order.ends_at > v_now then
    return jsonb_build_object(
      'order_id', v_order.id,
      'listing_id', v_order.listing_id,
      'status', v_order.status,
      'starts_at', v_order.starts_at,
      'ends_at', v_order.ends_at,
      'activated', false
    );
  end if;

  if v_order.status = 'active' and (v_order.ends_at is null or v_order.ends_at <= v_now) then
    update public.listing_boost_orders
    set status = 'expired'
    where id = v_order.id;
    perform private.reconcile_listing_boost_state(v_order.listing_id);
    return jsonb_build_object(
      'order_id', v_order.id,
      'listing_id', v_order.listing_id,
      'status', 'expired',
      'starts_at', v_order.starts_at,
      'ends_at', v_order.ends_at,
      'activated', false
    );
  end if;

  if p_activation_source = 'tbc' then
    if v_order.payment_provider <> 'tbc_checkout'
      or v_order.provider_status <> 'Succeeded'
      or v_order.paid_at is null then
      raise exception 'TBC payment has not been independently verified as succeeded.' using errcode = '42501';
    end if;
  elsif p_activation_source = 'admin' then
    if p_reviewed_by is null or not exists (
      select 1 from public.profiles p where p.id = p_reviewed_by and p.is_admin = true
    ) then
      raise exception 'A valid admin reviewer is required.' using errcode = '42501';
    end if;
  else
    raise exception 'Unsupported boost activation source.' using errcode = '22023';
  end if;

  if v_order.status not in ('pending_payment', 'under_review', 'approved') then
    raise exception 'Boost order status cannot be activated.' using errcode = '22023';
  end if;

  v_slot := case
    when p_featured_slot is not null and p_featured_slot > 0 then p_featured_slot
    when v_product.placement = 'banner_home' then coalesce(v_listing.home_banner_slot, 1)
    when v_product.placement in ('featured_home', 'combo') then coalesce(v_listing.featured_slot, 1)
    else null
  end;

  if v_product.placement = 'combo' then
    v_anchor := greatest(v_now, v_listing.vip_until, v_listing.promoted_until, v_listing.featured_until);
  elsif v_product.placement = 'vip' then
    v_anchor := greatest(v_now, v_listing.vip_until);
  elsif v_product.placement = 'promoted' then
    v_anchor := greatest(v_now, v_listing.promoted_until);
  elsif v_product.placement = 'featured_home' then
    v_anchor := greatest(v_now, v_listing.featured_until);
  elsif v_product.placement = 'banner_home' then
    v_anchor := greatest(v_now, v_listing.home_banner_until);
  else
    raise exception 'Unsupported boost placement.' using errcode = '22023';
  end if;

  v_ends_at := v_anchor + make_interval(days => v_product.duration_days);

  if v_product.placement in ('vip', 'combo') then
    v_listing.is_vip := true;
    v_listing.vip_until := v_ends_at;
  end if;

  if v_product.placement in ('promoted', 'combo') then
    v_listing.promoted_until := v_ends_at;
  end if;

  if v_product.placement in ('featured_home', 'combo') then
    v_listing.featured_until := v_ends_at;
    v_listing.featured_slot := coalesce(v_slot, 1);
  end if;

  if v_product.placement = 'banner_home' then
    v_listing.home_banner_until := v_ends_at;
    v_listing.home_banner_slot := coalesce(v_slot, 1);
  end if;

  update public.listings
  set
    is_vip = v_listing.is_vip,
    vip_until = v_listing.vip_until,
    promoted_until = v_listing.promoted_until,
    featured_until = v_listing.featured_until,
    featured_slot = v_listing.featured_slot,
    home_banner_until = v_listing.home_banner_until,
    home_banner_slot = v_listing.home_banner_slot
  where id = v_listing.id;

  update public.listing_boost_orders
  set
    status = 'active',
    starts_at = coalesce(starts_at, v_now),
    ends_at = v_ends_at,
    approved_at = coalesce(approved_at, v_now),
    reviewed_by = coalesce(p_reviewed_by, reviewed_by),
    placement_slot = v_slot,
    cancelled_at = null,
    failure_reason = null
  where id = v_order.id;

  insert into public.listing_boost_order_events (
    order_id,
    seller_id,
    source,
    event_type,
    provider_status,
    provider_result_code,
    message,
    payload
  ) values (
    v_order.id,
    v_order.seller_id,
    case when p_activation_source = 'admin' then 'admin' else 'system' end,
    'boost_activated',
    v_order.provider_status,
    v_order.provider_result_code,
    'Boost activated by trusted database logic.',
    jsonb_build_object('placement', v_product.placement, 'startsAt', v_now, 'endsAt', v_ends_at)
  );

  return jsonb_build_object(
    'order_id', v_order.id,
    'listing_id', v_order.listing_id,
    'status', 'active',
    'starts_at', coalesce(v_order.starts_at, v_now),
    'ends_at', v_ends_at,
    'activated', true
  );
end;
$$;

revoke all on function public.activate_listing_boost_order(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.activate_listing_boost_order(uuid, uuid, integer, text) to service_role;

create or replace function public.reconcile_listing_boosts(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.listings where id = p_listing_id) then
    return;
  end if;
  perform private.reconcile_listing_boost_state(p_listing_id);
end;
$$;

revoke all on function public.reconcile_listing_boosts(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_listing_boosts(uuid) to service_role;

create or replace function public.reconcile_expired_listing_boosts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing_id uuid;
  v_expired_count integer := 0;
  v_row_count integer := 0;
begin
  for v_listing_id in
    select distinct listing_id
    from public.listing_boost_orders
    where status = 'active'
      and ends_at <= now()
  loop
    with expired as (
      update public.listing_boost_orders
      set status = 'expired'
      where listing_id = v_listing_id
        and status = 'active'
        and ends_at <= now()
      returning id, seller_id, provider_status, provider_result_code, ends_at
    )
    insert into public.listing_boost_order_events (
      order_id,
      seller_id,
      source,
      event_type,
      provider_status,
      provider_result_code,
      message,
      payload
    )
    select
      id,
      seller_id,
      'system',
      'boost_expired',
      provider_status,
      provider_result_code,
      'Boost expired and listing promotion state was reconciled.',
      jsonb_build_object('endsAt', ends_at)
    from expired;

    get diagnostics v_row_count = row_count;
    v_expired_count := v_expired_count + v_row_count;
    perform private.reconcile_listing_boost_state(v_listing_id);
  end loop;

  return v_expired_count;
end;
$$;

revoke all on function public.reconcile_expired_listing_boosts() from public, anon, authenticated;
grant execute on function public.reconcile_expired_listing_boosts() to service_role;

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
  case when l.is_vip = true and l.vip_until > now() then true else false end as is_vip,
  case when l.promoted_until > now() then true else false end as is_promoted,
  case when l.featured_until > now() then true else false end as is_featured,
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
  p.seller_type as seller_type,
  p.avatar_url as seller_avatar_url,
  p.store_logo_url as seller_store_logo_url,
  case when l.home_banner_until > now() then true else false end as is_home_banner,
  l.home_banner_until,
  l.home_banner_slot,
  case
    when l.featured_until > now() then 3
    when l.promoted_until > now() then 2
    when l.is_vip = true and l.vip_until > now() then 1
    else 0
  end as promotion_tier
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

create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'reconcile-listing-boosts';

select cron.schedule(
  'reconcile-listing-boosts',
  '*/5 * * * *',
  'select public.reconcile_expired_listing_boosts();'
);
