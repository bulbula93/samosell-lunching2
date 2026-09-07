-- TBC approval-day preparation. This migration does not enable checkout and
-- does not initiate provider refunds. It adds internal audit/refund state and
-- narrows the public Data API surface for payment records.

alter table public.listing_boost_order_events
  add column if not exists event_key text;

alter table public.listing_boost_order_events
  drop constraint if exists listing_boost_order_events_event_key_key;

alter table public.listing_boost_order_events
  add constraint listing_boost_order_events_event_key_key unique (event_key);

alter table public.listing_boost_order_events
  drop constraint if exists listing_boost_order_events_source_check,
  drop constraint if exists listing_boost_order_events_event_type_check;

alter table public.listing_boost_order_events
  add constraint listing_boost_order_events_source_check
    check (source in ('create', 'callback', 'return', 'manual_sync', 'manual_admin_sync', 'admin', 'system', 'reconciliation', 'refund')),
  add constraint listing_boost_order_events_event_type_check
    check (event_type in (
      'order_created',
      'checkout_created',
      'callback_received',
      'return_sync',
      'status_synced',
      'payment_succeeded',
      'payment_pending',
      'payment_failed',
      'payment_expired',
      'payment_cancelled',
      'payment_returned',
      'payment_partially_returned',
      'boost_activated',
      'boost_expired',
      'boost_cancelled',
      'refund_requested',
      'refund_approved',
      'refund_rejected',
      'manual_admin_sync',
      'note'
    ));

create table if not exists public.listing_boost_refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.listing_boost_orders (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'requested'
    check (status in (
      'requested',
      'under_review',
      'approved',
      'rejected',
      'provider_processing',
      'refunded',
      'partially_refunded',
      'failed'
    )),
  amount numeric not null check (amount > 0),
  currency text not null default 'GEL' check (currency = 'GEL'),
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  requested_at timestamp with time zone not null default now(),
  reviewed_at timestamp with time zone,
  completed_at timestamp with time zone,
  provider_reference text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists listing_boost_refund_one_open_per_order_idx
  on public.listing_boost_refund_requests (order_id)
  where status in ('requested', 'under_review', 'approved', 'provider_processing');

create index if not exists listing_boost_refund_seller_created_idx
  on public.listing_boost_refund_requests (seller_id, created_at desc);

create index if not exists listing_boost_refund_status_created_idx
  on public.listing_boost_refund_requests (status, created_at desc);

create or replace function private.set_listing_boost_refund_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_listing_boost_refund_updated_at on public.listing_boost_refund_requests;
create trigger set_listing_boost_refund_updated_at
before update on public.listing_boost_refund_requests
for each row execute function private.set_listing_boost_refund_updated_at();

alter table public.listing_boost_refund_requests enable row level security;

drop policy if exists "sellers can read own boost refunds" on public.listing_boost_refund_requests;
create policy "sellers can read own boost refunds"
on public.listing_boost_refund_requests
for select
to authenticated
using ((select auth.uid()) = seller_id);

drop policy if exists "admins can read all boost refunds" on public.listing_boost_refund_requests;
create policy "admins can read all boost refunds"
on public.listing_boost_refund_requests
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

revoke all on table public.listing_boost_refund_requests from anon, authenticated;
grant select (id,order_id,seller_id,status,amount,currency,reason,requested_at,
  reviewed_at,completed_at,created_at,updated_at)
  on public.listing_boost_refund_requests to authenticated;
grant all on table public.listing_boost_refund_requests to service_role;

-- Payment/provider state is never client-writable. Admin mutations also use a
-- server-side service-role client after an explicit admin authorization check.
revoke insert, update, delete, truncate on table public.listing_boost_orders from anon, authenticated;
revoke insert, update, delete, truncate on table public.listing_boost_order_events from anon, authenticated;
revoke insert, update, delete, truncate on table public.listing_boost_products from anon, authenticated;

grant select on table public.listing_boost_orders to authenticated;
grant select on table public.listing_boost_order_events to authenticated;
grant select on table public.listing_boost_products to anon, authenticated;
grant all on table public.listing_boost_orders to service_role;
grant all on table public.listing_boost_order_events to service_role;
grant all on table public.listing_boost_products to service_role;

revoke all on function private.set_listing_boost_refund_updated_at() from public, anon, authenticated;
grant execute on function private.set_listing_boost_refund_updated_at() to service_role;

alter table public.listing_boost_orders
  add column if not exists last_payment_sync_attempt_at timestamptz;

-- Claim before calling the bank: one status lookup/order/minute is our own
-- conservative abuse limit, not a claim about TBC's contractual rate limit.
create or replace function public.claim_tbc_payment_sync(p_payment_id text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_order public.listing_boost_orders%rowtype;
begin
  select * into v_order from public.listing_boost_orders
    where provider_payment_id = p_payment_id and payment_provider = 'tbc_checkout'
    for update;
  if not found then return jsonb_build_object('outcome', 'missing'); end if;
  if v_order.last_payment_sync_attempt_at > clock_timestamp() - interval '1 minute' then
    return jsonb_build_object('outcome', 'busy', 'status', v_order.status, 'id', v_order.id);
  end if;
  update public.listing_boost_orders
    set last_payment_sync_attempt_at = clock_timestamp()
    where id = v_order.id returning * into v_order;
  return jsonb_build_object('outcome', 'claimed', 'id', v_order.id,
    'updated_at', v_order.updated_at, 'status', v_order.status);
end;
$$;

-- Only trusted server code can supply a response fetched from the provider.
-- Version check + row lock + activation + events commit as one transaction.
create or replace function public.apply_verified_tbc_payment(
  p_order_id uuid, p_expected_updated_at timestamptz, p_payment_id text,
  p_provider_status text, p_result_code text, p_amount numeric,
  p_currency text, p_source text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.listing_boost_orders%rowtype;
  v_event text;
  v_source_event text;
  v_activation jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_source not in ('callback','return','manual_sync','manual_admin_sync','reconciliation','system')
    or p_source is null or length(coalesce(p_provider_status,'')) > 80
    or length(coalesce(p_result_code,'')) > 80 then
    raise exception 'Invalid payment sync arguments' using errcode = '22023';
  end if;
  select * into v_order from public.listing_boost_orders where id = p_order_id for update;
  if not found or v_order.payment_provider is distinct from 'tbc_checkout'
    or v_order.provider_payment_id is distinct from p_payment_id then
    raise exception 'Payment order not found' using errcode = 'P0002';
  end if;
  if v_order.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('outcome','stale','order',jsonb_build_object('id',v_order.id,'status',v_order.status));
  end if;

  v_source_event := case p_source when 'callback' then 'callback_received'
    when 'return' then 'return_sync' when 'manual_admin_sync' then 'manual_admin_sync' else 'status_synced' end;
  insert into public.listing_boost_order_events
    (order_id,seller_id,source,event_type,provider_status,provider_result_code,message,event_key)
  values (v_order.id,v_order.seller_id,p_source,v_source_event,p_provider_status,p_result_code,
    'Authoritative provider response received.',
    v_order.id::text || ':' || p_source || ':' || v_source_event || ':' || coalesce(p_provider_status,'unknown'))
  on conflict (event_key) do nothing;

  -- Terminal provider states cannot regress; PartialReturned may become Returned.
  if (v_order.provider_status = 'Returned' and p_provider_status is distinct from 'Returned')
    or (v_order.provider_status = 'PartialReturned' and coalesce(p_provider_status,'') not in ('PartialReturned','Returned'))
    or (v_order.paid_at is not null and coalesce(p_provider_status,'') not in ('Succeeded','Returned','PartialReturned'))
    or (v_order.status in ('cancelled','rejected') and p_provider_status = 'Succeeded') then
    update public.listing_boost_orders set last_payment_sync_at = v_now where id = v_order.id;
    return jsonb_build_object('outcome','ignored','order',jsonb_build_object('id',v_order.id,'status',v_order.status));
  end if;

  if p_provider_status = 'Succeeded' then
    if p_amount is null or p_amount <= 0 or p_amount <> v_order.amount
      or p_currency is distinct from v_order.currency then
      update public.listing_boost_orders set
        status = case when status in ('pending_payment','approved') then 'under_review' else status end,
        last_payment_sync_at = v_now,
        failure_reason = 'Payment amount/currency mismatch; manual review required.'
        where id = v_order.id;
      v_event := 'note';
    elsif v_order.status in ('pending_payment','under_review','approved','active') then
      update public.listing_boost_orders set provider_status = p_provider_status,
        provider_result_code = p_result_code, paid_at = coalesce(paid_at,v_now),
        approved_at = coalesce(approved_at,v_now), last_payment_sync_at = v_now,
        failure_reason = null where id = v_order.id;
      v_activation := public.activate_listing_boost_order(v_order.id,null,null,'tbc');
      v_event := 'payment_succeeded';
    else
      update public.listing_boost_orders set last_payment_sync_at = v_now where id = v_order.id;
      v_event := 'note';
    end if;
  elsif p_provider_status in ('Failed','Expired','Returned','PartialReturned','CancelPaymentProcessing') then
    v_event := case p_provider_status when 'Failed' then 'payment_failed'
      when 'Expired' then 'payment_expired' when 'Returned' then 'payment_returned'
      when 'PartialReturned' then 'payment_partially_returned' else 'payment_cancelled' end;
    update public.listing_boost_orders set status = 'cancelled',
      provider_status = p_provider_status, provider_result_code = p_result_code,
      last_payment_sync_at = v_now, cancelled_at = coalesce(cancelled_at,v_now),
      failure_reason = 'TBC status: ' || p_provider_status where id = v_order.id;
    perform private.reconcile_listing_boost_state(v_order.listing_id);
    if p_provider_status in ('Returned','PartialReturned') then
      update public.listing_boost_refund_requests set
        status = case p_provider_status when 'Returned' then 'refunded' else 'partially_refunded' end,
        completed_at = v_now, provider_reference = p_payment_id
        where order_id = v_order.id and status in
          ('requested','under_review','approved','provider_processing','partially_refunded');
    end if;
  else
    update public.listing_boost_orders set provider_status = p_provider_status,
      provider_result_code = p_result_code, last_payment_sync_at = v_now,
      status = case when status in ('pending_payment','under_review','approved')
        then case when p_provider_status = 'WaitingConfirm' then 'under_review'
          else 'pending_payment' end else status end,
      failure_reason = case when p_provider_status not in ('Created','Processing','PaymentCompletionProcessing')
        or p_provider_status is null then 'Provider state requires manual review.' else null end
      where id = v_order.id;
    v_event := 'payment_pending';
  end if;

  insert into public.listing_boost_order_events
    (order_id,seller_id,source,event_type,provider_status,provider_result_code,message,event_key)
  values (v_order.id,v_order.seller_id,p_source,v_event,p_provider_status,p_result_code,
    'Verified payment state applied atomically.',
    v_order.id::text || ':provider:' || v_event || ':' || coalesce(p_provider_status,'unknown'))
  on conflict (event_key) do nothing;
  select * into v_order from public.listing_boost_orders where id = v_order.id;
  return jsonb_build_object('outcome','applied','order',jsonb_build_object('id',v_order.id,
    'status',v_order.status,'provider_status',v_order.provider_status),
    'activated',coalesce((v_activation->>'activated')::boolean,false));
end;
$$;

revoke all on function public.claim_tbc_payment_sync(text) from public, anon, authenticated;
grant execute on function public.claim_tbc_payment_sync(text) to service_role;
revoke all on function public.apply_verified_tbc_payment(uuid,timestamptz,text,text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.apply_verified_tbc_payment(uuid,timestamptz,text,text,text,numeric,text,text) to service_role;

-- Refund amount/ownership validation and audit are committed with the request.
create or replace function private.audit_boost_refund()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_order public.listing_boost_orders%rowtype; v_event text;
begin
  if tg_op = 'INSERT' then
    select * into v_order from public.listing_boost_orders where id = new.order_id for update;
    if not found or v_order.seller_id <> new.seller_id
      or v_order.payment_provider is distinct from 'tbc_checkout'
      or v_order.provider_status is distinct from 'Succeeded' or v_order.paid_at is null
      or v_order.amount <= 0 or new.status <> 'requested'
      or new.amount <> v_order.amount or new.currency <> v_order.currency then
      raise exception 'Refund order is not eligible' using errcode = '22023';
    end if;
    v_event := 'refund_requested';
  else
    if new.status = old.status then return new; end if;
    v_event := case new.status when 'approved' then 'refund_approved'
      when 'rejected' then 'refund_rejected' when 'refunded' then 'payment_returned'
      when 'partially_refunded' then 'payment_partially_returned' else 'note' end;
  end if;
  insert into public.listing_boost_order_events
    (order_id,seller_id,source,event_type,message,payload,event_key)
  values (new.order_id,new.seller_id,case
      when tg_op = 'INSERT' then 'refund'
      when new.status in ('refunded','partially_refunded') then 'system'
      else 'admin'
    end,
    v_event,'Refund workflow state: ' || new.status,
    jsonb_build_object('refundRequestId',new.id,'status',new.status),
    new.order_id::text || ':refund:' || new.id::text || ':' || new.status)
  on conflict (event_key) do nothing;
  return new;
end;
$$;
create trigger audit_boost_refund after insert or update on public.listing_boost_refund_requests
for each row execute function private.audit_boost_refund();
revoke all on function private.audit_boost_refund() from public,anon,authenticated;

create or replace function private.audit_boost_order_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.listing_boost_order_events
    (order_id,seller_id,source,event_type,message,event_key)
  values (new.id,new.seller_id,'create','order_created','Order created from trusted product data.',
    new.id::text || ':create:order_created');
  return new;
end;
$$;
create trigger audit_boost_order_created after insert on public.listing_boost_orders
for each row execute function private.audit_boost_order_created();
revoke all on function private.audit_boost_order_created() from public,anon,authenticated;

create or replace function private.require_verified_tbc_activation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status = 'active' and new.payment_provider = 'tbc_checkout'
    and (new.provider_status is distinct from 'Succeeded' or new.paid_at is null) then
    raise exception 'TBC activation requires verified payment' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger require_verified_tbc_activation before insert or update on public.listing_boost_orders
for each row execute function private.require_verified_tbc_activation();
revoke all on function private.require_verified_tbc_activation() from public,anon,authenticated;

create or replace function private.audit_boost_order_transition()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.listing_boost_order_events
      (order_id,seller_id,source,event_type,message,payload)
    values (new.id,new.seller_id,'system','note','Order state changed.',
      jsonb_build_object('from',old.status,'to',new.status));
  end if;
  return new;
end;
$$;
create trigger audit_boost_order_transition after update on public.listing_boost_orders
for each row execute function private.audit_boost_order_transition();
revoke all on function private.audit_boost_order_transition() from public,anon,authenticated;

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
    or (p_action = 'chat_commerce' and p_window_seconds = 600 and p_max_hits = 20)
    or (p_action = 'listing_report' and p_window_seconds = 3600 and p_max_hits = 10)
    or (p_action = 'push_subscription' and p_window_seconds = 600 and p_max_hits = 30)
    or (p_action = 'payment_create' and p_window_seconds = 3600 and p_max_hits = 10)
    or (p_action = 'payment_refund' and p_window_seconds = 3600 and p_max_hits = 5)
    or (p_action = 'listing_delete' and p_window_seconds = 3600 and p_max_hits = 6)
  ) then
    raise exception using errcode = 'P0001', message = 'bad_rate_limit_arguments';
  end if;

  insert into public.user_action_rate_limits (user_id, action, window_started_at, hits)
  values (v_user_id, p_action, v_now, 0)
  on conflict (user_id, action) do nothing;

  select * into v_row
  from public.user_action_rate_limits
  where user_id = v_user_id and action = p_action
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
    return query select true, v_row.hits + 1, p_max_hits,
      greatest(0, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
    return;
  end if;

  return query select false, v_row.hits, p_max_hits,
    greatest(0, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
end;
$$;

revoke all on function public.consume_action_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_action_rate_limit(text, integer, integer) to authenticated;

-- Parameterized, paginated search across all payment records, service only.
create or replace function public.search_admin_payment_orders(p_query text default '', p_status text default 'all')
returns setof public.listing_boost_orders language sql stable security invoker set search_path = ''
as $$
  select o.* from public.listing_boost_orders o
  left join public.listings l on l.id = o.listing_id
  left join public.profiles u on u.id = o.seller_id
  where (coalesce(p_query,'') = '' or position(lower(left(p_query,100)) in lower(
    concat_ws(' ',o.id::text,o.provider_payment_id,o.listing_id::text,o.seller_id::text,l.title,u.username,u.full_name)
  )) > 0)
  and (p_status = 'all'
    or (p_status = 'pending' and o.status in ('pending_payment','under_review','approved'))
    or (p_status = 'succeeded' and (o.provider_status = 'Succeeded' or o.status = 'active'))
    or (p_status = 'failed' and (o.provider_status = 'Failed' or o.status = 'rejected'))
    or (p_status = 'expired' and (o.provider_status = 'Expired' or o.status = 'expired'))
    or (p_status = 'stale' and o.payment_provider = 'tbc_checkout'
      and o.status in ('pending_payment','under_review','approved')
      and o.created_at < current_timestamp - interval '30 minutes')
    or (p_status = 'returned' and o.provider_status = 'Returned')
    or (p_status = 'partially_returned' and o.provider_status = 'PartialReturned')
    or (p_status = 'refund' and exists (select 1 from public.listing_boost_refund_requests r
      where r.order_id = o.id and r.status in ('requested','under_review','approved','provider_processing'))))
  order by o.created_at desc, o.id;
$$;
revoke all on function public.search_admin_payment_orders(text,text) from public,anon,authenticated;
grant execute on function public.search_admin_payment_orders(text,text) to service_role;
