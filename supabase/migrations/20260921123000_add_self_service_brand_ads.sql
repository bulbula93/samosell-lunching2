-- Paid self-service Brand Ads.
-- Additive and backward-compatible with the existing admin-managed ad system.

alter table public.ads
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists review_status text not null default 'approved';

alter table public.ads
  drop constraint if exists ads_review_status_check;

alter table public.ads
  add constraint ads_review_status_check
  check (review_status in ('pending', 'approved', 'rejected'));

create index if not exists ads_submitted_by_created_idx
  on public.ads (submitted_by, created_at desc)
  where submitted_by is not null;

drop policy if exists "users can read own submitted ads" on public.ads;
create policy "users can read own submitted ads"
on public.ads
for select
to authenticated
using (submitted_by = (select auth.uid()));

create table if not exists public.ad_products (
  id text primary key,
  name text not null,
  duration_days integer not null check (duration_days > 0),
  price numeric(10,2) not null check (price > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ad_products (id, name, duration_days, price, currency, description, is_active)
values (
  'home_brand_ad_7d',
  'Home Brand Ad',
  7,
  49.90,
  'GEL',
  'ბრენდის რეკლამა SamoSell-ის მთავარი გვერდის ერთ-ერთ ორ სარეკლამო ბლოკში 7 დღით.',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  duration_days = excluded.duration_days,
  price = excluded.price,
  currency = excluded.currency,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.ad_products enable row level security;
drop policy if exists "public can read active ad products" on public.ad_products;
create policy "public can read active ad products"
on public.ad_products
for select
to anon, authenticated
using (is_active = true);

revoke all on table public.ad_products from public, anon, authenticated;
grant select on table public.ad_products to anon, authenticated;
grant all on table public.ad_products to service_role;

create table if not exists public.ad_orders (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null unique references public.ads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id text not null references public.ad_products(id),
  status text not null default 'pending_payment',
  amount numeric(10,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  product_name_snapshot text not null,
  duration_days_snapshot integer not null check (duration_days_snapshot > 0),
  description_snapshot text,
  payment_provider text not null default 'flitt',
  provider_payment_id text,
  provider_status text,
  paid_at timestamptz,
  approved_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  selected_placement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_orders_status_check check (
    status in (
      'pending_payment',
      'paid_pending_review',
      'scheduled',
      'active',
      'expired',
      'cancelled',
      'payment_failed',
      'reversed'
    )
  ),
  constraint ad_orders_provider_check check (payment_provider = 'flitt'),
  constraint ad_orders_selected_placement_check check (
    selected_placement is null
    or selected_placement in ('home_hero_left', 'home_hero_right')
  ),
  constraint ad_orders_schedule_check check (
    starts_at is null or ends_at is null or starts_at < ends_at
  )
);

create index if not exists ad_orders_user_created_idx
  on public.ad_orders (user_id, created_at desc);
create index if not exists ad_orders_status_schedule_idx
  on public.ad_orders (status, starts_at, ends_at);

alter table public.ad_orders enable row level security;
drop policy if exists "users can read own ad orders" on public.ad_orders;
create policy "users can read own ad orders"
on public.ad_orders
for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.ad_orders from public, anon;
revoke insert, update, delete, truncate on table public.ad_orders from authenticated;
grant select on table public.ad_orders to authenticated;
grant all on table public.ad_orders to service_role;

alter table public.flitt_payment_attempts
  add column if not exists ad_order_id uuid references public.ad_orders(id) on delete cascade;

create unique index if not exists idx_flitt_payment_attempts_ad_order
  on public.flitt_payment_attempts (ad_order_id)
  where ad_order_id is not null;

alter table public.flitt_payment_attempts
  drop constraint if exists flitt_payment_attempts_purpose_check;

alter table public.flitt_payment_attempts
  add constraint flitt_payment_attempts_purpose_check
  check (purpose in ('sandbox_test', 'boost_order', 'ad_order'));

alter table public.flitt_payment_attempts
  drop constraint if exists flitt_payment_attempts_subject_check;

alter table public.flitt_payment_attempts
  add constraint flitt_payment_attempts_subject_check
  check (
    (purpose = 'sandbox_test' and boost_order_id is null and ad_order_id is null)
    or (purpose = 'boost_order' and boost_order_id is not null and ad_order_id is null)
    or (purpose = 'ad_order' and ad_order_id is not null and boost_order_id is null)
  );

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
    or v_attempt.provider_payment_id is null then
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
    paid_at = coalesce(paid_at, now()),
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

create or replace function public.reverse_flitt_ad_payment(p_order_id uuid)
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

  if not found
    or v_attempt.status <> 'reversed'
    or lower(coalesce(v_attempt.provider_status, '')) <> 'reversed'
    or lower(coalesce(v_attempt.response_status, '')) <> 'success' then
    raise exception 'Flitt ad reversal is not independently verified.' using errcode = '42501';
  end if;

  select * into v_order
  from public.ad_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Ad order not found.' using errcode = 'P0002';
  end if;

  if v_order.user_id is distinct from v_attempt.user_id
    or upper(v_order.currency) <> upper(v_attempt.currency)
    or round(v_order.amount * 100)::integer <> v_attempt.amount then
    raise exception 'Flitt reversal does not match the ad order.' using errcode = '42501';
  end if;

  update public.ad_orders
  set
    status = 'reversed',
    provider_status = 'reversed',
    updated_at = now()
  where id = p_order_id;

  update public.ads
  set
    is_active = false,
    updated_at = now()
  where id = v_order.ad_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'ad_id', v_order.ad_id,
    'status', 'reversed',
    'changed', true
  );
end;
$$;

revoke all on function public.reverse_flitt_ad_payment(uuid) from public, anon, authenticated;
grant execute on function public.reverse_flitt_ad_payment(uuid) to service_role;

create or replace function public.fail_flitt_ad_payment(p_order_id uuid)
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

  if not found
    or v_attempt.status not in ('declined', 'expired', 'failed')
    or lower(coalesce(v_attempt.response_status, '')) <> 'success'
    or lower(coalesce(v_attempt.provider_status, '')) in ('', 'approved', 'reversed') then
    raise exception 'Flitt ad payment failure is not independently verified.' using errcode = '42501';
  end if;

  select * into v_order
  from public.ad_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Ad order not found.' using errcode = 'P0002';
  end if;

  if v_order.user_id is distinct from v_attempt.user_id
    or upper(v_order.currency) <> upper(v_attempt.currency)
    or round(v_order.amount * 100)::integer <> v_attempt.amount then
    raise exception 'Flitt failure does not match the ad order.' using errcode = '42501';
  end if;

  if v_order.status = 'payment_failed' then
    return jsonb_build_object(
      'order_id', v_order.id,
      'ad_id', v_order.ad_id,
      'status', v_order.status,
      'changed', false
    );
  end if;

  if v_order.status <> 'pending_payment' then
    return jsonb_build_object(
      'order_id', v_order.id,
      'ad_id', v_order.ad_id,
      'status', v_order.status,
      'changed', false
    );
  end if;

  update public.ad_orders
  set
    status = 'payment_failed',
    provider_status = v_attempt.provider_status,
    updated_at = now()
  where id = p_order_id
  returning * into v_order;

  update public.ads
  set is_active = false, updated_at = now()
  where id = v_order.ad_id;

  return jsonb_build_object(
    'order_id', v_order.id,
    'ad_id', v_order.ad_id,
    'status', v_order.status,
    'changed', true
  );
end;
$$;

revoke all on function public.fail_flitt_ad_payment(uuid) from public, anon, authenticated;
grant execute on function public.fail_flitt_ad_payment(uuid) to service_role;

create or replace function public.approve_self_service_ad(
  p_ad_id uuid,
  p_reviewed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ad public.ads%rowtype;
  v_order public.ad_orders%rowtype;
  v_left_until timestamptz;
  v_right_until timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_placement text;
  v_duration interval;
  v_interval record;
  v_now timestamptz := now();
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_reviewed_by
      and p.is_admin = true
  ) then
    raise exception 'A valid admin reviewer is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('samosell_self_service_brand_ad_slots'));

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

  if not found or v_order.status <> 'paid_pending_review' or v_order.paid_at is null then
    raise exception 'Self-service ad has not been paid and verified.' using errcode = '42501';
  end if;

  v_duration := make_interval(days => v_order.duration_days_snapshot);

  -- Find the earliest non-overlapping seven-day window in each slot. This
  -- accounts for queued future ads and for manually-created unbounded ads
  -- (ends_at IS NULL), while the advisory lock prevents concurrent approvals
  -- from choosing the same window.
  v_left_until := v_now;
  for v_interval in
    select
      coalesce(a.starts_at, '-infinity'::timestamptz) as starts_at,
      a.ends_at
    from public.ads a
    where a.is_active = true
      and a.placement_key = 'home_hero_left'
      and a.id <> p_ad_id
    order by coalesce(a.starts_at, '-infinity'::timestamptz), a.ends_at nulls last
  loop
    if v_interval.ends_at is not null and v_interval.ends_at <= v_left_until then
      continue;
    end if;
    if v_interval.starts_at >= v_left_until + v_duration then
      exit;
    end if;
    if v_interval.ends_at is null then
      v_left_until := 'infinity'::timestamptz;
      exit;
    end if;
    if v_interval.ends_at > v_left_until then
      v_left_until := v_interval.ends_at;
    end if;
  end loop;

  v_right_until := v_now;
  for v_interval in
    select
      coalesce(a.starts_at, '-infinity'::timestamptz) as starts_at,
      a.ends_at
    from public.ads a
    where a.is_active = true
      and a.placement_key = 'home_hero_right'
      and a.id <> p_ad_id
    order by coalesce(a.starts_at, '-infinity'::timestamptz), a.ends_at nulls last
  loop
    if v_interval.ends_at is not null and v_interval.ends_at <= v_right_until then
      continue;
    end if;
    if v_interval.starts_at >= v_right_until + v_duration then
      exit;
    end if;
    if v_interval.ends_at is null then
      v_right_until := 'infinity'::timestamptz;
      exit;
    end if;
    if v_interval.ends_at > v_right_until then
      v_right_until := v_interval.ends_at;
    end if;
  end loop;

  if v_left_until = 'infinity'::timestamptz and v_right_until = 'infinity'::timestamptz then
    raise exception 'No finite Brand Ad slot availability.' using errcode = '55000';
  end if;

  if v_left_until <= v_right_until then
    v_placement := 'home_hero_left';
    v_start := v_left_until;
  else
    v_placement := 'home_hero_right';
    v_start := v_right_until;
  end if;

  v_end := v_start + v_duration;

  update public.ads
  set
    placement_key = v_placement,
    review_status = 'approved',
    is_active = true,
    starts_at = v_start,
    ends_at = v_end,
    updated_at = now()
  where id = p_ad_id;

  update public.ad_orders
  set
    status = case when v_start <= v_now then 'active' else 'scheduled' end,
    selected_placement = v_placement,
    starts_at = v_start,
    ends_at = v_end,
    approved_at = coalesce(approved_at, v_now),
    reviewed_by = p_reviewed_by,
    updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'ad_id', v_order.ad_id,
    'status', v_order.status,
    'placement', v_order.selected_placement,
    'starts_at', v_order.starts_at,
    'ends_at', v_order.ends_at
  );
end;
$$;

revoke all on function public.approve_self_service_ad(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_self_service_ad(uuid, uuid) to service_role;

create or replace function public.reconcile_self_service_brand_ads()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_changed integer := 0;
begin
  update public.ad_orders
  set status = 'active', updated_at = now()
  where status = 'scheduled'
    and starts_at <= now()
    and ends_at > now();

  get diagnostics v_changed = row_count;
  v_count := v_count + v_changed;

  with expired as (
    update public.ad_orders
    set status = 'expired', updated_at = now()
    where status in ('scheduled', 'active')
      and ends_at <= now()
    returning ad_id
  )
  update public.ads a
  set is_active = false, updated_at = now()
  where a.id in (select ad_id from expired);

  get diagnostics v_changed = row_count;
  v_count := v_count + v_changed;

  return v_count;
end;
$$;

revoke all on function public.reconcile_self_service_brand_ads() from public, anon, authenticated;
grant execute on function public.reconcile_self_service_brand_ads() to service_role;

create or replace function public.get_own_ad_event_counts()
returns table (
  ad_id uuid,
  impressions bigint,
  clicks bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.ad_id,
    count(*) filter (where e.event_type = 'impression')::bigint as impressions,
    count(*) filter (where e.event_type = 'click')::bigint as clicks
  from public.ad_orders o
  left join public.ad_events e on e.ad_id = o.ad_id
  where o.user_id = (select auth.uid())
  group by o.ad_id
$$;

revoke all on function public.get_own_ad_event_counts() from public, anon;
grant execute on function public.get_own_ad_event_counts() to authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'reconcile-self-service-brand-ads';

select cron.schedule(
  'reconcile-self-service-brand-ads',
  '*/5 * * * *',
  'select public.reconcile_self_service_brand_ads();'
);

comment on table public.ad_orders is
  'Paid self-service SamoSell Brand Ad orders. Browser roles may only read their own rows.';
