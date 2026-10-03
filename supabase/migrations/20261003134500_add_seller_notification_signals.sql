begin;

create or replace function public.notify_listing_favorite_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller_id uuid;
  v_title text;
  v_slug text;
  v_status text;
  v_event_key text;
  v_day text;
begin
  select l.seller_id, l.title, l.slug, l.status
  into v_seller_id, v_title, v_slug, v_status
  from public.listings l
  where l.id = new.listing_id;

  if not found
    or v_status <> 'active'
    or v_seller_id is null
    or v_seller_id = new.user_id
  then
    return new;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = new.user_id
      and p.is_suspended
  ) then
    return new;
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = new.user_id and b.blocked_id = v_seller_id)
       or (b.blocker_id = v_seller_id and b.blocked_id = new.user_id)
  ) then
    return new;
  end if;

  v_day := to_char(timezone('UTC', coalesce(new.created_at, now())), 'YYYY-MM-DD');
  v_event_key := format('favorite_activity:%s:%s', new.listing_id, v_day);

  insert into public.notifications as existing (
    user_id,
    type,
    title,
    body,
    href,
    actor_id,
    listing_id,
    event_key,
    metadata,
    created_at
  ) values (
    v_seller_id,
    'favorite_activity',
    'შენი ნივთი მოეწონათ',
    format('„%s“ დღეს 1 მომხმარებელმა შეინახა.', v_title),
    '/listing/' || v_slug,
    new.user_id,
    new.listing_id,
    v_event_key,
    jsonb_build_object(
      'count', 1,
      'day', v_day,
      'last_actor_id', new.user_id,
      'last_favorite_at', coalesce(new.created_at, now())
    ),
    coalesce(new.created_at, now())
  )
  on conflict (event_key) do update
  set
    title = 'შენი ნივთი მოეწონათ',
    body = format(
      '„%s“ დღეს %s მომხმარებელმა შეინახა.',
      v_title,
      coalesce((existing.metadata->>'count')::integer, 1) + 1
    ),
    actor_id = new.user_id,
    metadata = existing.metadata || jsonb_build_object(
      'count', coalesce((existing.metadata->>'count')::integer, 1) + 1,
      'last_actor_id', new.user_id,
      'last_favorite_at', coalesce(new.created_at, now())
    ),
    read_at = null,
    created_at = greatest(existing.created_at, coalesce(new.created_at, now()));

  return new;
end;
$$;

revoke all on function public.notify_listing_favorite_activity() from public, anon, authenticated;

drop trigger if exists favorites_notify_listing_owner on public.favorites;
create trigger favorites_notify_listing_owner
after insert on public.favorites
for each row execute function public.notify_listing_favorite_activity();

create or replace function public.generate_seller_reminder_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
  v_step integer := 0;
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    href,
    actor_id,
    listing_id,
    event_key,
    metadata
  )
  select
    l.seller_id,
    'boost_expiry',
    'VIP მალე იწურება',
    format(
      '„%s“-ის VIP სტატუსი 24 საათზე ნაკლებში იწურება. სურვილის შემთხვევაში წინასწარ გააგრძელე.',
      l.title
    ),
    '/dashboard/listings/' || l.id::text || '/promote',
    null,
    l.id,
    format(
      'boost_expiry:%s:%s',
      l.id,
      extract(epoch from l.vip_until)::bigint
    ),
    jsonb_build_object(
      'vip_until', l.vip_until,
      'kind', 'vip_expiry_24h'
    )
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.status = 'active'
    and coalesce(p.is_suspended, false) = false
    and l.vip_until is not null
    and l.vip_until > now()
    and l.vip_until <= now() + interval '24 hours'
  on conflict (event_key) do nothing;

  get diagnostics v_step = row_count;
  v_inserted := v_inserted + v_step;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    href,
    actor_id,
    listing_id,
    event_key,
    metadata
  )
  select
    l.seller_id,
    'listing_stale',
    'განცხადება განაახლე?',
    format(
      '„%s“ 7 დღეა არ განახლებულა. გადაამოწმე ფასი, ფოტოები ან აღწერა, რომ ისევ აქტუალური იყოს.',
      l.title
    ),
    '/dashboard/listings/' || l.id::text || '/edit',
    null,
    l.id,
    format(
      'listing_stale:%s:%s',
      l.id,
      extract(epoch from coalesce(l.updated_at, l.published_at, l.created_at))::bigint
    ),
    jsonb_build_object(
      'last_activity_at', coalesce(l.updated_at, l.published_at, l.created_at),
      'kind', 'listing_stale_7d'
    )
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.status = 'active'
    and coalesce(p.is_suspended, false) = false
    and coalesce(l.updated_at, l.published_at, l.created_at) <= now() - interval '7 days'
  on conflict (event_key) do nothing;

  get diagnostics v_step = row_count;
  v_inserted := v_inserted + v_step;

  return v_inserted;
end;
$$;

revoke all on function public.generate_seller_reminder_notifications() from public, anon, authenticated;
grant execute on function public.generate_seller_reminder_notifications() to service_role;

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
    'boost_expiry'
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
begin
  if exists (select 1 from cron.job where jobname = 'samosell-seller-reminders') then
    perform cron.unschedule(
      (select jobid from cron.job where jobname = 'samosell-seller-reminders' limit 1)
    );
  end if;

  perform cron.schedule(
    'samosell-seller-reminders',
    '17 * * * *',
    'select public.generate_seller_reminder_notifications();'
  );
exception when others then
  null;
end;
$$;

commit;
