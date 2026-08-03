-- Applied follow-up: keep the DB-backed limiter callable by authenticated server actions,
-- but prevent callers from weakening a rule by supplying arbitrary limits.
-- The insert-first pattern also removes the first-hit unique-key race.

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
    or (p_action = 'chat_start' and p_window_seconds = 600 and p_max_hits = 20)
    or (p_action = 'chat_message' and p_window_seconds = 60 and p_max_hits = 20)
    or (p_action = 'listing_report' and p_window_seconds = 3600 and p_max_hits = 10)
  ) then
    raise exception using errcode = 'P0001', message = 'bad_rate_limit_arguments';
  end if;

  insert into public.user_action_rate_limits (
    user_id,
    action,
    window_started_at,
    hits
  )
  values (
    v_user_id,
    p_action,
    v_now,
    0
  )
  on conflict (user_id, action) do nothing;

  select *
  into v_row
  from public.user_action_rate_limits
  where user_id = v_user_id
    and action = p_action
  for update;

  v_reset_at := v_row.window_started_at + make_interval(secs => p_window_seconds);

  if v_now >= v_reset_at then
    update public.user_action_rate_limits
    set
      window_started_at = v_now,
      hits = 1
    where user_id = v_user_id
      and action = p_action;

    return query select true, 1, p_max_hits, 0;
    return;
  end if;

  if v_row.hits < p_max_hits then
    update public.user_action_rate_limits
    set hits = v_row.hits + 1
    where user_id = v_user_id
      and action = p_action;

    return query
      select
        true,
        v_row.hits + 1,
        p_max_hits,
        greatest(
          0,
          ceil(extract(epoch from (v_reset_at - v_now)))::integer
        );
    return;
  end if;

  return query
    select
      false,
      v_row.hits,
      p_max_hits,
      greatest(
        0,
        ceil(extract(epoch from (v_reset_at - v_now)))::integer
      );
end;
$$;

revoke all on function public.consume_action_rate_limit(text, integer, integer)
  from public, anon;
grant execute on function public.consume_action_rate_limit(text, integer, integer)
  to authenticated;
