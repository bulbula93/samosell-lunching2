-- Require the same authoritative Flitt Status API marker used by boost
-- finalization before a Brand Ad order can become paid_pending_review.
create or replace function public.finalize_flitt_ad_payment(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.flitt_payment_attempts%rowtype;
  v_order public.ad_orders%rowtype;
begin
  select * into v_attempt
  from public.flitt_payment_attempts
  where ad_order_id = p_order_id
    and purpose = 'ad_order'
  for update;

  if not found then
    raise exception 'Flitt ad payment attempt not found.' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'approved'
    or lower(coalesce(v_attempt.provider_status, '')) <> 'approved'
    or lower(coalesce(v_attempt.response_status, '')) <> 'success'
    or v_attempt.provider_payment_id is null
    or v_attempt.provider_verified_at is null
    or v_attempt.provider_verification_source <> 'status_api' then
    raise exception 'Flitt ad payment is not independently verified as approved.' using errcode = '42501';
  end if;

  select * into v_order
  from public.ad_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Ad order not found.' using errcode = 'P0002';
  end if;

  if v_order.user_id is distinct from v_attempt.user_id
    or v_order.payment_provider <> 'flitt'
    or upper(v_order.currency) <> upper(v_attempt.currency)
    or round(v_order.amount * 100)::integer <> v_attempt.amount
    or (v_order.provider_payment_id is not null and v_order.provider_payment_id <> v_attempt.provider_payment_id) then
    raise exception 'Flitt attempt does not match the ad order.' using errcode = '42501';
  end if;

  if v_order.status in ('paid_pending_review', 'scheduled', 'active', 'expired') then
    return jsonb_build_object(
      'order_id', v_order.id,
      'ad_id', v_order.ad_id,
      'status', v_order.status,
      'paid_at', v_order.paid_at,
      'changed', false
    );
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Ad order cannot be finalized from its current state.' using errcode = '22023';
  end if;

  update public.ad_orders
  set
    status = 'paid_pending_review',
    provider_payment_id = coalesce(provider_payment_id, v_attempt.provider_payment_id),
    provider_status = 'approved',
    paid_at = coalesce(paid_at, v_attempt.provider_verified_at),
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'ad_id', v_order.ad_id,
    'status', v_order.status,
    'paid_at', v_order.paid_at,
    'changed', true
  );
end;
$$;

revoke all on function public.finalize_flitt_ad_payment(uuid) from public, anon, authenticated;
grant execute on function public.finalize_flitt_ad_payment(uuid) to service_role;
