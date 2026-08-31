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
  if not exists (
    select 1
    from public.push_deliveries d
    join public.push_subscriptions s on s.id = d.subscription_id and s.is_active
    where d.attempt_count < 5
      and (
        d.status = 'pending'
        or (d.status = 'processing' and d.last_attempt_at < now() - interval '5 minutes')
      )
  ) then
    return null;
  end if;

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
declare
  v_enqueued integer := 0;
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

  get diagnostics v_enqueued = row_count;
  if v_enqueued > 0 then
    perform public.request_push_dispatch();
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_notification_push() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'samosell-push-dispatch') then
    perform cron.unschedule((select jobid from cron.job where jobname = 'samosell-push-dispatch' limit 1));
  end if;
  perform cron.schedule('samosell-push-dispatch', '*/5 * * * *', 'select public.request_push_dispatch();');
exception when others then
  null;
end;
$$;
