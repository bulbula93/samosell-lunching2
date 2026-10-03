-- Useful seller notifications with deterministic event keys.
-- This migration is intentionally safe to run repeatedly: event_key uniqueness
-- prevents duplicates and the cron job is replaced by name.

create or replace function public.enqueue_seller_engagement_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_count integer := 0;
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    href,
    listing_id,
    event_key,
    metadata
  )
  select
    l.seller_id,
    'boost_expiry',
    'VIP მალე იწურება',
    '„' || left(l.title, 100) || '“-ის VIP სტატუსს 24 საათზე ნაკლები დარჩა.',
    '/dashboard/listings/' || l.id::text || '/promote',
    l.id,
    'boost_expiry:' || l.id::text || ':' || extract(epoch from l.vip_until)::bigint::text,
    jsonb_build_object(
      'vip_until', l.vip_until,
      'source', 'daily_engagement_scan'
    )
  from public.listings l
  where l.status = 'active'
    and l.is_vip = true
    and l.vip_until is not null
    and l.vip_until > now()
    and l.vip_until <= now() + interval '24 hours'
  on conflict (event_key) do nothing;

  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    href,
    listing_id,
    event_key,
    metadata
  )
  select
    l.seller_id,
    'listing_stale',
    'განცხადება განაახლე',
    '„' || left(l.title, 100) || '“ 7 დღეა არ განახლებულა. მცირე განახლებაც დაეხმარება მყიდველებს აქტუალური ინფორმაციის ნახვაში.',
    '/dashboard/listings/' || l.id::text || '/edit',
    l.id,
    'listing_stale:' || l.id::text || ':' || extract(epoch from coalesce(l.updated_at, l.published_at, l.created_at))::bigint::text,
    jsonb_build_object(
      'last_activity_at', coalesce(l.updated_at, l.published_at, l.created_at),
      'source', 'daily_engagement_scan'
    )
  from public.listings l
  where l.status = 'active'
    and coalesce(l.updated_at, l.published_at, l.created_at) <= now() - interval '7 days'
  on conflict (event_key) do nothing;

  get diagnostics v_count = row_count;
  v_inserted := v_inserted + v_count;

  return v_inserted;
end;
$$;

revoke all on function public.enqueue_seller_engagement_notifications() from public, anon, authenticated;
grant execute on function public.enqueue_seller_engagement_notifications() to service_role;

-- Include the new high-value event types in web-push delivery.
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
    'review_request',
    'favorite_added',
    'boost_expiry',
    'listing_stale'
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

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'samosell-engagement-notifications'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'samosell-engagement-notifications',
    '0 6 * * *',
    'select public.enqueue_seller_engagement_notifications()'
  );
end
$$;
