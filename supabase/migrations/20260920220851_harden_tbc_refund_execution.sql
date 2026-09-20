alter table public.listing_boost_refund_requests
  add column if not exists provider_attempted_at timestamptz,
  add column if not exists provider_last_checked_at timestamptz,
  add column if not exists provider_http_status integer,
  add column if not exists provider_result_code text,
  add column if not exists provider_error text;

create or replace function public.claim_tbc_refund_execution(
  p_refund_id uuid,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.listing_boost_refund_requests%rowtype;
  v_order public.listing_boost_orders%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_admin_id is null or not exists (
    select 1 from public.profiles p
    where p.id = p_admin_id and p.is_admin = true
  ) then
    raise exception 'A valid admin reviewer is required.' using errcode = '42501';
  end if;

  select * into v_refund
  from public.listing_boost_refund_requests
  where id = p_refund_id
  for update;

  if not found then
    return jsonb_build_object('outcome','missing');
  end if;

  if v_refund.status = 'provider_processing' then
    return jsonb_build_object(
      'outcome','already_processing',
      'refund_id',v_refund.id,
      'order_id',v_refund.order_id,
      'payment_id',v_refund.provider_reference,
      'amount',v_refund.amount,
      'currency',v_refund.currency
    );
  end if;

  if v_refund.status in ('refunded','partially_refunded','rejected','failed') then
    return jsonb_build_object('outcome','terminal','status',v_refund.status,'refund_id',v_refund.id);
  end if;

  if v_refund.status not in ('requested','under_review','approved') then
    raise exception 'Refund request state cannot be executed.' using errcode = '22023';
  end if;

  select * into v_order
  from public.listing_boost_orders
  where id = v_refund.order_id
  for update;

  if not found
    or v_order.seller_id <> v_refund.seller_id
    or v_order.payment_provider is distinct from 'tbc_checkout'
    or v_order.provider_payment_id is null
    or v_order.provider_status is distinct from 'Succeeded'
    or v_order.paid_at is null
    or v_refund.amount <> v_order.amount
    or v_refund.currency <> v_order.currency
    or v_refund.currency <> 'GEL' then
    raise exception 'Refund request no longer matches an eligible TBC payment.' using errcode = '22023';
  end if;

  if v_refund.status <> 'approved' then
    update public.listing_boost_refund_requests
    set
      status = 'approved',
      reviewed_by = p_admin_id,
      reviewed_at = coalesce(reviewed_at, v_now)
    where id = v_refund.id;
  end if;

  update public.listing_boost_refund_requests
  set
    status = 'provider_processing',
    reviewed_by = p_admin_id,
    reviewed_at = coalesce(reviewed_at, v_now),
    provider_reference = v_order.provider_payment_id,
    provider_attempted_at = v_now,
    provider_http_status = null,
    provider_result_code = null,
    provider_error = null
  where id = v_refund.id
  returning * into v_refund;

  insert into public.listing_boost_order_events (
    order_id,seller_id,source,event_type,message,payload,event_key
  ) values (
    v_order.id,v_order.seller_id,'refund','note',
    'TBC refund execution claimed; provider cancel request may be sent once.',
    jsonb_build_object('refundRequestId',v_refund.id,'paymentId',v_order.provider_payment_id,'amount',v_refund.amount,'currency',v_refund.currency),
    v_order.id::text || ':refund:' || v_refund.id::text || ':provider_execution_claimed'
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object(
    'outcome','claimed',
    'refund_id',v_refund.id,
    'order_id',v_order.id,
    'payment_id',v_order.provider_payment_id,
    'amount',v_refund.amount,
    'currency',v_refund.currency
  );
end;
$$;

create or replace function public.record_tbc_refund_execution_result(
  p_refund_id uuid,
  p_outcome text,
  p_http_status integer default null,
  p_result_code text default null,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.listing_boost_refund_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_event_key text;
begin
  if p_outcome not in ('accepted','rejected','ambiguous') then
    raise exception 'Invalid refund execution outcome.' using errcode = '22023';
  end if;

  select * into v_refund
  from public.listing_boost_refund_requests
  where id = p_refund_id
  for update;

  if not found then
    return jsonb_build_object('outcome','missing');
  end if;

  if v_refund.status in ('refunded','partially_refunded') then
    return jsonb_build_object('outcome','terminal','status',v_refund.status);
  end if;

  if v_refund.status <> 'provider_processing' then
    return jsonb_build_object('outcome','ignored','status',v_refund.status);
  end if;

  if p_outcome = 'rejected' then
    update public.listing_boost_refund_requests
    set
      status = 'failed',
      completed_at = v_now,
      provider_http_status = p_http_status,
      provider_result_code = left(p_result_code,160),
      provider_error = left(p_error,1000),
      provider_last_checked_at = v_now
    where id = v_refund.id
    returning * into v_refund;
  else
    update public.listing_boost_refund_requests
    set
      provider_http_status = p_http_status,
      provider_result_code = left(p_result_code,160),
      provider_error = case when p_outcome = 'ambiguous' then left(p_error,1000) else null end,
      provider_last_checked_at = case when p_outcome = 'accepted' then v_now else provider_last_checked_at end
    where id = v_refund.id
    returning * into v_refund;
  end if;

  v_event_key := v_refund.order_id::text || ':refund:' || v_refund.id::text || ':provider_' || p_outcome;
  insert into public.listing_boost_order_events (
    order_id,seller_id,source,event_type,message,payload,event_key
  ) values (
    v_refund.order_id,v_refund.seller_id,'refund','note',
    case p_outcome
      when 'accepted' then 'TBC accepted the refund cancel request; authoritative payment status will be reconciled.'
      when 'rejected' then 'TBC explicitly rejected the refund cancel request.'
      else 'TBC refund request outcome is ambiguous; automatic duplicate cancel is blocked pending status reconciliation.'
    end,
    jsonb_build_object(
      'refundRequestId',v_refund.id,
      'outcome',p_outcome,
      'httpStatus',p_http_status,
      'resultCode',left(p_result_code,160)
    ),
    v_event_key
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object('outcome',p_outcome,'status',v_refund.status,'refund_id',v_refund.id);
end;
$$;

create or replace function public.verify_tbc_recovery_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(p_token,'') = (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'samosell_tbc_recovery_token'
      limit 1
    ),
    false
  );
$$;

revoke all on function public.claim_tbc_refund_execution(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_tbc_refund_execution(uuid,uuid) to service_role;

revoke all on function public.record_tbc_refund_execution_result(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.record_tbc_refund_execution_result(uuid,text,integer,text,text) to service_role;

revoke all on function public.verify_tbc_recovery_token(text) from public,anon,authenticated;
grant execute on function public.verify_tbc_recovery_token(text) to service_role;
