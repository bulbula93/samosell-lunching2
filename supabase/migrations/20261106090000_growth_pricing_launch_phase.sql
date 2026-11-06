-- Growth pricing (launch phase), 2026-11-06
-- 1) Free first VIP: one free 7-day VIP per seller, activated by trusted DB logic.
-- 2) Home ad slot: admin "partner" ads share the same 3-seat capacity as paid ads.
-- 3) Paid self-service home ads are paused until home traffic justifies a price.

-- 1a. Allow the promotional payment method (amount must be 0, enforced below).
alter table public.listing_boost_orders drop constraint listing_boost_orders_payment_method_check;
alter table public.listing_boost_orders add constraint listing_boost_orders_payment_method_check
  check (payment_method = any (array['bank_transfer','manual_cash','card_external','tbc_checkout','flitt','promo_first_vip']));
alter table public.listing_boost_orders add constraint listing_boost_orders_promo_is_free_check
  check (payment_method is distinct from 'promo_first_vip' or (amount = 0 and product_id = 'vip_7d'));

-- 1b. Hard guarantee: at most one free VIP per seller, ever.
create unique index if not exists listing_boost_orders_one_free_vip_per_seller
  on public.listing_boost_orders (seller_id)
  where payment_method = 'promo_first_vip';

-- 1c. activate_listing_boost_order: identical to production except the new 'promo' source branch.
CREATE OR REPLACE FUNCTION public.activate_listing_boost_order(p_order_id uuid, p_reviewed_by uuid DEFAULT NULL::uuid, p_featured_slot integer DEFAULT NULL::integer, p_activation_source text DEFAULT 'system'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  elsif p_activation_source = 'promo' then
    -- Launch promotion: one free 7-day VIP per seller, created only by
    -- public.claim_first_free_vip. Never valid for paid or non-VIP orders.
    if v_order.payment_method is distinct from 'promo_first_vip'
      or v_order.amount <> 0
      or v_placement is distinct from 'vip' then
      raise exception 'Promotional activation is only valid for the free first VIP.' using errcode = '42501';
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
$function$;
revoke all on function public.activate_listing_boost_order(uuid,uuid,integer,text) from public, anon, authenticated;

-- 1d. Seller-facing claim. Ownership, active listing and one-per-seller are checked here.
create or replace function public.claim_first_free_vip(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_product public.listing_boost_products%rowtype;
  v_order_id uuid := gen_random_uuid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('samosell_first_free_vip:' || v_uid::text));

  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found or v_listing.seller_id <> v_uid then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'listing_not_active' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.listing_boost_orders
    where seller_id = v_uid and payment_method = 'promo_first_vip'
  ) then
    raise exception 'promo_already_used' using errcode = '23505';
  end if;

  select * into v_product from public.listing_boost_products where id = 'vip_7d' and is_active;
  if not found then
    raise exception 'promo_unavailable' using errcode = '22023';
  end if;

  insert into public.listing_boost_orders (id, listing_id, seller_id, product_id, status, payment_method, amount, currency, notes)
  values (v_order_id, p_listing_id, v_uid, 'vip_7d', 'approved', 'promo_first_vip', 0, v_product.currency,
          'Free first VIP (launch promotion).');

  return public.activate_listing_boost_order(v_order_id, null, null, 'promo');
end;
$function$;
revoke all on function public.claim_first_free_vip(uuid) from public, anon;
grant execute on function public.claim_first_free_vip(uuid) to authenticated;

-- 2. Paid approvals also count admin-run (partner) home ads toward the 3 seats.
CREATE OR REPLACE FUNCTION public.approve_self_service_ad(p_ad_id uuid, p_reviewed_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ad public.ads%rowtype; v_order public.ad_orders%rowtype; v_start timestamptz; v_end timestamptz; v_now timestamptz:=now(); v_duration interval;
begin
 if not exists(select 1 from public.profiles p where p.id=p_reviewed_by and p.is_admin=true) then raise exception 'A valid admin reviewer is required.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('samosell_self_service_brand_ad_rotation'));
 select * into v_ad from public.ads where id=p_ad_id for update;
 if not found or v_ad.submitted_by is null then raise exception 'Self-service ad not found.' using errcode='P0002'; end if;
 if v_ad.review_status <> 'pending' then raise exception 'Self-service ad is not pending moderation.' using errcode='22023'; end if;
 select * into v_order from public.ad_orders where ad_id=p_ad_id for update;
 if not found or v_order.status<>'paid_pending_review' or v_order.paid_at is null then raise exception 'Self-service ad has not been paid and verified.' using errcode='42501'; end if;
 v_duration:=make_interval(days=>v_order.duration_days_snapshot);

 select candidate into v_start
 from (
   select v_now as candidate
   union
   select ends_at from public.ad_orders
   where status in ('active','scheduled') and ends_at>v_now
   union
   select a.ends_at from public.ads a
   where a.submitted_by is null and a.is_active and a.placement_key in ('home_hero_left','home_hero_right') and a.ends_at>v_now
 ) candidates
 where (
   (select count(*) from public.ad_orders o
     where o.status in ('active','scheduled')
       and coalesce(o.starts_at,v_now) <= candidate
       and o.ends_at > candidate)
   +
   (select count(*) from public.ads a
     where a.submitted_by is null and a.is_active
       and a.placement_key in ('home_hero_left','home_hero_right')
       and coalesce(a.starts_at,v_now) <= candidate
       and (a.ends_at is null or a.ends_at > candidate))
 ) < 3
 order by candidate
 limit 1;
 if v_start is null then v_start:=v_now; end if;

 v_end:=v_start+v_duration;
 update public.ads set placement_key='home_hero_left',review_status='approved',is_active=true,starts_at=v_start,ends_at=v_end,updated_at=now() where id=p_ad_id;
 update public.ad_orders set status=case when v_start<=v_now then 'active' else 'scheduled' end,selected_placement='home_hero_left',starts_at=v_start,ends_at=v_end,approved_at=coalesce(approved_at,v_now),reviewed_by=p_reviewed_by,updated_at=now() where id=v_order.id returning * into v_order;
 return jsonb_build_object('order_id',v_order.id,'ad_id',v_order.ad_id,'status',v_order.status,'placement','home_rotation','starts_at',v_order.starts_at,'ends_at',v_order.ends_at,'active_limit',3);
end; $function$;

-- 3. Pause paid self-service home ads (launch phase). Re-enable with is_active = true.
update public.ad_products set is_active = false, updated_at = now() where id = 'home_brand_ad_7d';
