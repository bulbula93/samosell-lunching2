-- Final hardening for paid listing boosts.
-- 1) Protect promotion fields on INSERT as well as UPDATE.
-- 2) Prevent ordinary clients from inserting raw boost orders.
-- 3) Make VIP MAX/combo renew only from an existing combo period, while preserving longer standalone placements.

create or replace function private.protect_listing_promotion_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_vip, false) = true
      or new.vip_until is not null
      or new.promoted_until is not null
      or new.featured_until is not null
      or new.featured_slot is not null
      or new.home_banner_until is not null
      or new.home_banner_slot is not null then
      raise exception 'Promotion fields can only be set by trusted boost activation logic.'
        using errcode = '42501';
    end if;

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
before insert or update on public.listings
for each row
execute function private.protect_listing_promotion_fields();

-- Boost orders are created only by trusted server-side code after ownership and
-- product validation. Sellers keep read access to their own orders.
drop policy if exists "sellers can create own boost orders" on public.listing_boost_orders;
revoke insert on table public.listing_boost_orders from anon, authenticated;
grant insert on table public.listing_boost_orders to service_role;

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
  v_combo_until timestamp with time zone;
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
    when v_product.placement = 'banner_home' then coalesce(v_listing.home_banner_slot, 1)
    when v_product.placement in ('featured_home', 'combo') then coalesce(v_listing.featured_slot, 1)
    else null
  end;

  if v_product.placement = 'combo' then
    -- A 7-day VIP MAX must not inherit an unrelated 30-day VIP/TOP expiry.
    -- Only an already-active VIP MAX period may be extended by another VIP MAX purchase.
    select max(o.ends_at)
    into v_combo_until
    from public.listing_boost_orders o
    join public.listing_boost_products p on p.id = o.product_id
    where o.listing_id = v_order.listing_id
      and o.id <> v_order.id
      and o.status = 'active'
      and o.ends_at > v_now
      and p.placement = 'combo';

    v_anchor := greatest(v_now, coalesce(v_combo_until, v_now));
  elsif v_product.placement = 'vip' then
    v_anchor := greatest(v_now, coalesce(v_listing.vip_until, v_now));
  elsif v_product.placement = 'promoted' then
    v_anchor := greatest(v_now, coalesce(v_listing.promoted_until, v_now));
  elsif v_product.placement = 'featured_home' then
    v_anchor := greatest(v_now, coalesce(v_listing.featured_until, v_now));
  elsif v_product.placement = 'banner_home' then
    v_anchor := greatest(v_now, coalesce(v_listing.home_banner_until, v_now));
  else
    raise exception 'Unsupported boost placement.' using errcode = '22023';
  end if;

  v_ends_at := v_anchor + make_interval(days => v_product.duration_days);

  if v_product.placement in ('vip', 'combo') then
    v_listing.is_vip := true;
    v_listing.vip_until := greatest(coalesce(v_listing.vip_until, v_ends_at), v_ends_at);
  end if;

  if v_product.placement in ('promoted', 'combo') then
    v_listing.promoted_until := greatest(coalesce(v_listing.promoted_until, v_ends_at), v_ends_at);
  end if;

  if v_product.placement in ('featured_home', 'combo') then
    v_listing.featured_until := greatest(coalesce(v_listing.featured_until, v_ends_at), v_ends_at);
    v_listing.featured_slot := coalesce(v_slot, 1);
  end if;

  if v_product.placement = 'banner_home' then
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
      'placement', v_product.placement,
      'startsAt', v_now,
      'endsAt', v_ends_at,
      'comboAnchor', case when v_product.placement = 'combo' then v_anchor else null end
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

revoke all on function public.activate_listing_boost_order(uuid, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.activate_listing_boost_order(uuid, uuid, integer, text)
  to service_role;
