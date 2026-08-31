create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_length check (char_length(endpoint) between 20 and 2048),
  constraint push_subscriptions_p256dh_length check (char_length(p256dh) between 20 and 512),
  constraint push_subscriptions_auth_length check (char_length(auth_secret) between 8 and 256)
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(user_id, is_active);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','gone')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 10),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique(notification_id, subscription_id)
);

create index if not exists push_deliveries_dispatch_idx
  on public.push_deliveries(status, created_at)
  where status in ('pending','processing');

alter table public.push_deliveries enable row level security;
revoke all on table public.push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.push_deliveries to service_role;

create table if not exists public.push_config (
  id smallint primary key default 1 check (id = 1),
  vapid_public_key text not null,
  vapid_private_key text not null,
  dispatch_secret text not null,
  subject text not null default 'https://samosell.ge',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_config enable row level security;
revoke all on table public.push_config from public, anon, authenticated;
grant select, insert, update, delete on table public.push_config to service_role;

create or replace function public.request_push_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select c.dispatch_secret into v_secret
  from public.push_config c
  where c.id = 1;

  if coalesce(v_secret, '') = '' then
    return null;
  end if;

  select net.http_post(
    url := 'https://lxsvjzbiuewgwpajqrwr.supabase.co/functions/v1/push-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('secret', v_secret),
    timeout_milliseconds := 8000
  ) into v_request_id;

  return v_request_id;
exception when others then
  return null;
end;
$$;

revoke all on function public.request_push_dispatch() from public, anon, authenticated;
grant execute on function public.request_push_dispatch() to service_role;

create or replace function public.enqueue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type not in (
    'chat_started',
    'chat_message',
    'offer_created',
    'offer_accepted',
    'offer_rejected',
    'reservation_created',
    'reservation_released',
    'saved_search_match',
    'price_drop',
    'review_request'
  ) then
    return new;
  end if;

  insert into public.push_deliveries(notification_id, subscription_id)
  select new.id, s.id
  from public.push_subscriptions s
  where s.user_id = new.user_id
    and s.is_active
  on conflict (notification_id, subscription_id) do nothing;

  perform public.request_push_dispatch();
  return new;
end;
$$;

revoke all on function public.enqueue_notification_push() from public, anon, authenticated;

drop trigger if exists notifications_enqueue_web_push on public.notifications;
create trigger notifications_enqueue_web_push
after insert on public.notifications
for each row execute function public.enqueue_notification_push();

create or replace function public.claim_push_deliveries(p_limit integer default 50)
returns table (
  delivery_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth_secret text,
  notification_id uuid,
  notification_type text,
  title text,
  body text,
  href text
)
language sql
security definer
set search_path = ''
as $$
  with chosen as (
    select d.id
    from public.push_deliveries d
    join public.push_subscriptions s on s.id = d.subscription_id and s.is_active
    where d.attempt_count < 5
      and (
        d.status = 'pending'
        or (d.status = 'processing' and d.last_attempt_at < now() - interval '5 minutes')
      )
    order by d.created_at asc
    for update of d skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ), claimed as (
    update public.push_deliveries d
    set status = 'processing',
        attempt_count = d.attempt_count + 1,
        last_attempt_at = now(),
        last_error = null
    from chosen c
    where d.id = c.id
    returning d.id, d.subscription_id, d.notification_id
  )
  select
    c.id,
    c.subscription_id,
    s.endpoint,
    s.p256dh,
    s.auth_secret,
    n.id,
    n.type,
    n.title,
    coalesce(n.body, ''),
    coalesce(n.href, '/dashboard/notifications')
  from claimed c
  join public.push_subscriptions s on s.id = c.subscription_id
  join public.notifications n on n.id = c.notification_id;
$$;

revoke all on function public.claim_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer) to service_role;

create or replace function public.finish_push_delivery(
  p_delivery_id uuid,
  p_status text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription_id uuid;
  v_attempts smallint;
begin
  if p_status not in ('sent','pending','failed','gone') then
    raise exception 'invalid_push_delivery_status';
  end if;

  update public.push_deliveries d
  set status = p_status,
      delivered_at = case when p_status = 'sent' then now() else d.delivered_at end,
      last_error = left(nullif(p_error, ''), 500)
  where d.id = p_delivery_id
  returning d.subscription_id, d.attempt_count into v_subscription_id, v_attempts;

  if not found then
    return false;
  end if;

  if p_status = 'gone' then
    update public.push_subscriptions
    set is_active = false, updated_at = now()
    where id = v_subscription_id;
  elsif p_status = 'pending' and v_attempts >= 5 then
    update public.push_deliveries
    set status = 'failed'
    where id = p_delivery_id;
  end if;

  return true;
end;
$$;

revoke all on function public.finish_push_delivery(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finish_push_delivery(uuid, text, text) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'samosell-push-dispatch') then
    perform cron.unschedule((select jobid from cron.job where jobname = 'samosell-push-dispatch' limit 1));
  end if;
  perform cron.schedule('samosell-push-dispatch', '* * * * *', 'select public.request_push_dispatch();');
exception when others then
  null;
end;
$$;

-- Production setup note: insert one row into public.push_config with generated VAPID keys
-- and a dispatch secret through a protected operational channel. Never commit the private key.
