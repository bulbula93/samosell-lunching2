alter table public.listing_boost_orders
  add column if not exists placement_snapshot text,
  add column if not exists duration_days_snapshot integer;

update public.listing_boost_orders o
set
  placement_snapshot = p.placement,
  duration_days_snapshot = p.duration_days
from public.listing_boost_products p
where p.id = o.product_id
  and (o.placement_snapshot is null or o.duration_days_snapshot is null);

alter table public.listing_boost_orders
  alter column placement_snapshot set not null,
  alter column duration_days_snapshot set not null;

alter table public.listing_boost_orders
  drop constraint if exists listing_boost_orders_duration_snapshot_check,
  add constraint listing_boost_orders_duration_snapshot_check
    check (duration_days_snapshot > 0);

create or replace function private.set_boost_order_product_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_placement text;
  v_duration_days integer;
begin
  select p.placement, p.duration_days
  into v_placement, v_duration_days
  from public.listing_boost_products p
  where p.id = new.product_id;

  if not found or v_duration_days <= 0 then
    raise exception 'Boost product is invalid.' using errcode = '22023';
  end if;

  new.placement_snapshot := v_placement;
  new.duration_days_snapshot := v_duration_days;
  return new;
end;
$$;

create or replace function private.prevent_boost_order_terms_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_id is distinct from old.product_id
    or new.placement_snapshot is distinct from old.placement_snapshot
    or new.duration_days_snapshot is distinct from old.duration_days_snapshot then
    raise exception 'Boost order product terms are immutable.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists set_boost_order_product_snapshot on public.listing_boost_orders;
create trigger set_boost_order_product_snapshot
before insert on public.listing_boost_orders
for each row execute function private.set_boost_order_product_snapshot();

drop trigger if exists prevent_boost_order_terms_mutation on public.listing_boost_orders;
create trigger prevent_boost_order_terms_mutation
before update of product_id, placement_snapshot, duration_days_snapshot
on public.listing_boost_orders
for each row execute function private.prevent_boost_order_terms_mutation();

revoke all on function private.set_boost_order_product_snapshot() from public, anon, authenticated;
revoke all on function private.prevent_boost_order_terms_mutation() from public, anon, authenticated;

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
    max(o.ends_at) filter (where o.placement_snapshot in ('vip', 'combo')),
    max(o.ends_at) filter (where o.placement_snapshot in ('promoted', 'combo')),
    max(o.ends_at) filter (where o.placement_snapshot in ('featured_home', 'combo')),
    max(o.ends_at) filter (where o.placement_snapshot = 'banner_home'),
    (array_agg(o.placement_slot order by o.ends_at desc) filter (
      where o.placement_snapshot in ('featured_home', 'combo') and o.placement_slot is not null
    ))[1],
    (array_agg(o.placement_slot order by o.ends_at desc) filter (
      where o.placement_snapshot = 'banner_home' and o.placement_slot is not null
    ))[1]
  into
    v_vip_until,
    v_promoted_until,
    v_featured_until,
    v_banner_until,
    v_featured_slot,
    v_banner_slot
  from public.listing_boost_orders o
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
  v_now timestamp with time zone := now();
  v_anchor timestamp with time zone;
  v_combo_until timestamp with time zone;
  v_ends_at timestamp with time zone;
  v_slot integer;
  v_placement text;
  v_duration_days integer;
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

  v_placement := v_order.placement_snapshot;
  v_duration_days := v_order.duration_days_snapshot;

  if v_placement is null or v_duration_days is null or v_duration_days <= 0 then
    raise exception 'Boost order product snapshot is invalid.' using errcode = '22023';
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
  elsif p_activation_source = 'flitt' then
    if v_order.payment_provider <> 'flitt'
      or lower(coalesce(v_order.provider_status, '')) <> 'approved'
      or v_order.paid_at is null then
      raise exception 'Flitt payment has not been independently verified as approved.' using errcode = '42501';
    end if;
  elsif p_activation_source = 'admin' then
    if p_reviewed_by is null or not exists (
      select 1
      from public.profiles p
      where p.id = p_reviewed_by
        and p.is_admin = true
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
    when v_placement = 'banner_home' then coalesce(v_listing.home_banner_slot, 1)
    when v_placement in ('featured_home', 'combo') then coalesce(v_listing.featured_slot, 1)
    else null
  end;

  if v_placement = 'combo' then
    select max(o.ends_at)
    into v_combo_until
    from public.listing_boost_orders o
    where o.listing_id = v_order.listing_id
      and o.id <> v_order.id
      and o.status = 'active'
      and o.ends_at > v_now
      and o.placement_snapshot = 'combo';

    v_anchor := greatest(v_now, coalesce(v_combo_until, v_now));
  elsif v_placement = 'vip' then
    v_anchor := greatest(v_now, coalesce(v_listing.vip_until, v_now));
  elsif v_placement = 'promoted' then
    v_anchor := greatest(v_now, coalesce(v_listing.promoted_until, v_now));
  elsif v_placement = 'featured_home' then
    v_anchor := greatest(v_now, coalesce(v_listing.featured_until, v_now));
  elsif v_placement = 'banner_home' then
    v_anchor := greatest(v_now, coalesce(v_listing.home_banner_until, v_now));
  else
    raise exception 'Unsupported boost placement.' using errcode = '22023';
  end if;

  v_ends_at := v_anchor + make_interval(days => v_duration_days);

  if v_placement in ('vip', 'combo') then
    v_listing.is_vip := true;
    v_listing.vip_until := greatest(coalesce(v_listing.vip_until, v_ends_at), v_ends_at);
  end if;

  if v_placement in ('promoted', 'combo') then
    v_listing.promoted_until := greatest(coalesce(v_listing.promoted_until, v_ends_at), v_ends_at);
  end if;

  if v_placement in ('featured_home', 'combo') then
    v_listing.featured_until := greatest(coalesce(v_listing.featured_until, v_ends_at), v_ends_at);
    v_listing.featured_slot := coalesce(v_slot, 1);
  end if;

  if v_placement = 'banner_home' then
    v_listing.home_banner_until := greatest(coalesce(v_listing.home_banner_until, v_ends_at), v_ends_at);
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
    jsonb_build_object(
      'placement', v_placement,
      'durationDays', v_duration_days,
      'startsAt', v_now,
      'endsAt', v_ends_at,
      'comboAnchor', case when v_placement = 'combo' then v_anchor else null end,
      'activationSource', p_activation_source
    )
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
