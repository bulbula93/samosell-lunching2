-- Reconcile a provider-verified Flitt reversal with the canonical boost state.
-- The callback persists the independently verified status first, then invokes
-- this service-role-only function. Repeated calls are intentionally idempotent.

create or replace function public.reverse_flitt_boost_payment(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.flitt_payment_attempts%rowtype;
  v_order public.listing_boost_orders%rowtype;
  v_changed boolean;
begin
  select * into v_attempt
  from public.flitt_payment_attempts
  where boost_order_id = p_order_id
    and purpose = 'boost_order'
  for update;

  if not found then
    raise exception 'Flitt boost payment attempt not found.' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'reversed'
    or lower(coalesce(v_attempt.provider_status, '')) <> 'reversed'
    or lower(coalesce(v_attempt.response_status, '')) <> 'success'
    or v_attempt.provider_payment_id is null then
    raise exception 'Flitt payment attempt is not independently verified as reversed.' using errcode = '42501';
  end if;

  select * into v_order
  from public.listing_boost_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Boost order not found.' using errcode = 'P0002';
  end if;

  if v_order.seller_id is distinct from v_attempt.user_id
    or v_order.payment_provider <> 'flitt'
    or v_order.payment_method <> 'flitt'
    or upper(v_order.currency) <> upper(v_attempt.currency)
    or round(v_order.amount::numeric * 100)::integer <> v_attempt.amount
    or (v_order.provider_payment_id is not null and v_order.provider_payment_id <> v_attempt.provider_payment_id) then
    raise exception 'Flitt attempt does not match the boost order.' using errcode = '42501';
  end if;

  v_changed := v_order.status is distinct from 'cancelled'
    or lower(coalesce(v_order.provider_status, '')) is distinct from 'reversed';

  update public.listing_boost_orders
  set
    status = 'cancelled',
    provider_payment_id = coalesce(provider_payment_id, v_attempt.provider_payment_id),
    provider_status = 'reversed',
    provider_result_code = v_attempt.response_status,
    last_payment_sync_at = now(),
    cancelled_at = coalesce(cancelled_at, now()),
    failure_reason = 'Flitt status: reversed'
  where id = p_order_id;

  perform private.reconcile_listing_boost_state(v_order.listing_id);

  insert into public.listing_boost_order_events (
    order_id, seller_id, source, event_type, provider_status,
    provider_result_code, message, event_key
  ) values (
    v_order.id, v_order.seller_id, 'callback', 'payment_returned', 'reversed',
    v_attempt.response_status, 'Verified Flitt reversal reconciled.',
    v_order.id::text || ':provider:payment_returned:reversed'
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object(
    'order_id', v_order.id,
    'listing_id', v_order.listing_id,
    'status', 'cancelled',
    'reconciled', true,
    'changed', v_changed
  );
end;
$$;

revoke all on function public.reverse_flitt_boost_payment(uuid) from public, anon, authenticated;
grant execute on function public.reverse_flitt_boost_payment(uuid) to service_role;

comment on function public.reverse_flitt_boost_payment(uuid) is
  'Cancels a Flitt boost and recomputes listing entitlements after a trusted authoritative reversed status; service-role only.';
