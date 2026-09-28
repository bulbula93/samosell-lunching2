-- Complete self-service ad moderation with rejection reason and refund state.
alter table public.ad_orders
  add column if not exists rejection_reason text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null,
  add column if not exists refund_status text,
  add column if not exists refund_error text;

alter table public.ad_orders
  drop constraint if exists ad_orders_rejection_reason_check,
  drop constraint if exists ad_orders_refund_status_check;

alter table public.ad_orders
  add constraint ad_orders_rejection_reason_check
    check (
      rejection_reason is null
      or char_length(btrim(rejection_reason)) between 5 and 500
    ),
  add constraint ad_orders_refund_status_check
    check (refund_status is null or refund_status in ('pending', 'succeeded', 'failed'));

create index if not exists ad_orders_refund_status_idx
  on public.ad_orders (refund_status, updated_at desc)
  where refund_status is not null;

create or replace function public.reject_self_service_ad(
  p_ad_id uuid,
  p_reviewed_by uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ad public.ads%rowtype;
  v_order public.ad_orders%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'A rejection reason between 5 and 500 characters is required.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_reviewed_by and p.is_admin = true
  ) then
    raise exception 'A valid admin reviewer is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('samosell_self_service_brand_ad_moderation'));

  select * into v_ad
  from public.ads
  where id = p_ad_id
  for update;

  if not found or v_ad.submitted_by is null then
    raise exception 'Self-service ad not found.' using errcode = 'P0002';
  end if;

  select * into v_order
  from public.ad_orders
  where ad_id = p_ad_id
  for update;

  if not found then
    raise exception 'Self-service ad order not found.' using errcode = 'P0002';
  end if;

  if v_order.status = 'reversed' and v_order.refund_status = 'succeeded' then
    return jsonb_build_object(
      'order_id', v_order.id,
      'status', v_order.status,
      'refund_status', v_order.refund_status,
      'needs_refund', false
    );
  end if;

  if not (
    (v_ad.review_status = 'pending' and v_order.status = 'paid_pending_review')
    or
    (v_ad.review_status = 'rejected' and v_order.status = 'cancelled' and v_order.refund_status = 'failed')
  ) then
    raise exception 'Ad is not eligible for rejection/refund.' using errcode = '22023';
  end if;

  update public.ads
  set
    review_status = 'rejected',
    is_active = false,
    updated_at = now()
  where id = p_ad_id;

  update public.ad_orders
  set
    status = 'cancelled',
    rejection_reason = v_reason,
    rejected_at = coalesce(rejected_at, now()),
    rejected_by = p_reviewed_by,
    refund_status = 'pending',
    refund_error = null,
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'refund_status', v_order.refund_status,
    'needs_refund', true
  );
end;
$$;

revoke all on function public.reject_self_service_ad(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reject_self_service_ad(uuid, uuid, text) to service_role;

-- Carousel inventory: up to 10 concurrent paid campaigns, then queue at the earliest available capacity.
create or replace function public.approve_self_service_ad(p_ad_id uuid,p_reviewed_by uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
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
 ) candidates
 where (
   select count(*) from public.ad_orders o
   where o.status in ('active','scheduled')
     and coalesce(o.starts_at,v_now) <= candidate
     and o.ends_at > candidate
 ) < 10
 order by candidate
 limit 1;
 if v_start is null then v_start:=v_now; end if;

 v_end:=v_start+v_duration;
 update public.ads set placement_key='home_hero_left',review_status='approved',is_active=true,starts_at=v_start,ends_at=v_end,updated_at=now() where id=p_ad_id;
 update public.ad_orders set status=case when v_start<=v_now then 'active' else 'scheduled' end,selected_placement='home_hero_left',starts_at=v_start,ends_at=v_end,approved_at=coalesce(approved_at,v_now),reviewed_by=p_reviewed_by,updated_at=now() where id=v_order.id returning * into v_order;
 return jsonb_build_object('order_id',v_order.id,'ad_id',v_order.ad_id,'status',v_order.status,'placement','home_rotation','starts_at',v_order.starts_at,'ends_at',v_order.ends_at,'active_limit',10);
end; $$;
revoke all on function public.approve_self_service_ad(uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_self_service_ad(uuid,uuid) to service_role;

