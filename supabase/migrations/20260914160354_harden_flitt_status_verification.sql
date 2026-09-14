alter table public.flitt_payment_attempts
  add column if not exists provider_verified_at timestamp with time zone,
  add column if not exists provider_verification_source text;

alter table public.flitt_payment_attempts
  drop constraint if exists flitt_payment_attempts_verification_source_check;

alter table public.flitt_payment_attempts
  add constraint flitt_payment_attempts_verification_source_check
  check (provider_verification_source is null or provider_verification_source = 'status_api');

create or replace function public.finalize_flitt_boost_payment(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.flitt_payment_attempts%rowtype;
  v_order public.listing_boost_orders%rowtype;
  v_result jsonb;
begin
  select * into v_attempt
  from public.flitt_payment_attempts
  where boost_order_id = p_order_id
    and purpose = 'boost_order'
  for update;

  if not found then
    raise exception 'Flitt boost payment attempt not found.' using errcode = 'P0002';
  end if;

  if v_attempt.status <> 'approved'
    or lower(coalesce(v_attempt.provider_status, '')) <> 'approved'
    or lower(coalesce(v_attempt.response_status, '')) <> 'success'
    or v_attempt.provider_payment_id is null
    or v_attempt.provider_verified_at is null
    or v_attempt.provider_verification_source <> 'status_api' then
    raise exception 'Flitt payment attempt is not independently verified as approved.' using errcode = '42501';
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

  update public.listing_boost_orders
  set
    provider_payment_id = coalesce(provider_payment_id, v_attempt.provider_payment_id),
    provider_status = 'approved',
    provider_result_code = v_attempt.response_status,
    paid_at = coalesce(paid_at, v_attempt.provider_verified_at),
    last_payment_sync_at = now(),
    failure_reason = null
  where id = p_order_id;

  v_result := public.activate_listing_boost_order(
    p_order_id,
    null,
    null,
    'flitt'
  );

  return v_result;
end;
$$;

revoke all on function public.finalize_flitt_boost_payment(uuid) from public, anon, authenticated;
grant execute on function public.finalize_flitt_boost_payment(uuid) to service_role;

comment on function public.finalize_flitt_boost_payment(uuid) is
  'Finalizes a Flitt boost only after an independently signed status API response is persisted; service-role only.';
