-- Applied correction: preserve the validated message body when an idempotency lookup has no row.
-- In PL/pgSQL, SELECT INTO clears target variables on no result, so validated
-- input and returned database values must use separate variables.

create or replace function public.start_chat_with_message(
  p_listing_id uuid,
  p_body text,
  p_client_request_id uuid
)
returns table (
  chat_id uuid,
  message_id uuid,
  message_body text,
  message_created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_seller_id uuid;
  v_listing_status text;
  v_chat_id uuid;
  v_message_id uuid;
  v_message_chat_id uuid;
  v_validated_body text := btrim(coalesce(p_body, ''));
  v_result_body text;
  v_message_created_at timestamp with time zone;
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_buyer_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if char_length(v_validated_body) < 1 then
    raise exception using errcode = 'P0001', message = 'message_empty';
  end if;
  if char_length(v_validated_body) > 2000 then
    raise exception using errcode = 'P0001', message = 'message_too_long';
  end if;
  if p_client_request_id is null then
    raise exception using errcode = 'P0001', message = 'request_id_required';
  end if;

  select l.seller_id, l.status
  into v_seller_id, v_listing_status
  from public.listings l
  join public.profiles seller_profile on seller_profile.id = l.seller_id
  where l.id = p_listing_id
    and l.status = 'active'
    and not seller_profile.is_suspended;

  if not found or v_listing_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'listing_unavailable';
  end if;
  if v_seller_id = v_buyer_id then
    raise exception using errcode = 'P0001', message = 'self_conversation';
  end if;
  if exists (
    select 1
    from public.user_blocks block_row
    where
      (block_row.blocker_id = v_buyer_id and block_row.blocked_id = v_seller_id)
      or
      (block_row.blocker_id = v_seller_id and block_row.blocked_id = v_buyer_id)
  ) then
    raise exception using errcode = 'P0001', message = 'conversation_blocked';
  end if;

  select m.id, m.chat_id, m.body, m.created_at
  into v_message_id, v_message_chat_id, v_result_body, v_message_created_at
  from public.messages m
  join public.chats c on c.id = m.chat_id
  where m.sender_id = v_buyer_id
    and m.client_request_id = p_client_request_id
    and c.listing_id = p_listing_id
    and c.buyer_id = v_buyer_id
    and c.seller_id = v_seller_id;

  if found then
    return query
      select v_message_chat_id, v_message_id, v_result_body, v_message_created_at;
    return;
  end if;

  select rate.allowed, rate.retry_after_seconds
  into v_allowed, v_retry_after
  from public.consume_action_rate_limit('chat_message', 60, 20) rate;

  if not coalesce(v_allowed, false) then
    raise exception using
      errcode = 'P0001',
      message = 'message_rate_limited',
      hint = greatest(coalesce(v_retry_after, 60), 1)::text;
  end if;

  insert into public.chats (
    listing_id,
    buyer_id,
    seller_id,
    buyer_last_read_at
  )
  values (
    p_listing_id,
    v_buyer_id,
    v_seller_id,
    now()
  )
  on conflict (listing_id, buyer_id, seller_id) do nothing
  returning id into v_chat_id;

  if v_chat_id is null then
    select c.id
    into v_chat_id
    from public.chats c
    where c.listing_id = p_listing_id
      and c.buyer_id = v_buyer_id
      and c.seller_id = v_seller_id;
  end if;

  if v_chat_id is null then
    raise exception using errcode = 'P0001', message = 'conversation_create_failed';
  end if;

  insert into public.messages (
    chat_id,
    sender_id,
    body,
    client_request_id
  )
  values (
    v_chat_id,
    v_buyer_id,
    v_validated_body,
    p_client_request_id
  )
  on conflict (sender_id, client_request_id)
    where client_request_id is not null
    do nothing
  returning id, body, created_at
  into v_message_id, v_result_body, v_message_created_at;

  if v_message_id is null then
    select m.id, m.chat_id, m.body, m.created_at
    into v_message_id, v_message_chat_id, v_result_body, v_message_created_at
    from public.messages m
    where m.sender_id = v_buyer_id
      and m.client_request_id = p_client_request_id;

    if v_message_chat_id is distinct from v_chat_id then
      raise exception using errcode = 'P0001', message = 'request_id_conflict';
    end if;
  end if;

  update public.chats
  set buyer_archived_at = null
  where id = v_chat_id
    and buyer_id = v_buyer_id;

  return query
    select v_chat_id, v_message_id, v_result_body, v_message_created_at;
end;
$$;

create or replace function public.send_chat_message(
  p_chat_id uuid,
  p_body text,
  p_client_request_id uuid
)
returns table (
  message_id uuid,
  message_body text,
  message_created_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_buyer_id uuid;
  v_seller_id uuid;
  v_listing_status text;
  v_message_id uuid;
  v_message_chat_id uuid;
  v_validated_body text := btrim(coalesce(p_body, ''));
  v_result_body text;
  v_message_created_at timestamp with time zone;
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if char_length(v_validated_body) < 1 then
    raise exception using errcode = 'P0001', message = 'message_empty';
  end if;
  if char_length(v_validated_body) > 2000 then
    raise exception using errcode = 'P0001', message = 'message_too_long';
  end if;
  if p_client_request_id is null then
    raise exception using errcode = 'P0001', message = 'request_id_required';
  end if;

  select c.buyer_id, c.seller_id, l.status
  into v_buyer_id, v_seller_id, v_listing_status
  from public.chats c
  join public.listings l on l.id = c.listing_id
  where c.id = p_chat_id
    and (c.buyer_id = v_user_id or c.seller_id = v_user_id);

  if not found then
    raise exception using errcode = 'P0001', message = 'conversation_not_found';
  end if;
  if v_listing_status not in ('active', 'reserved', 'sold') then
    raise exception using errcode = 'P0001', message = 'conversation_read_only';
  end if;
  if exists (
    select 1
    from public.profiles current_profile
    where current_profile.id = v_user_id
      and current_profile.is_suspended
  ) then
    raise exception using errcode = 'P0001', message = 'account_suspended';
  end if;
  if exists (
    select 1
    from public.user_blocks block_row
    where
      (block_row.blocker_id = v_buyer_id and block_row.blocked_id = v_seller_id)
      or
      (block_row.blocker_id = v_seller_id and block_row.blocked_id = v_buyer_id)
  ) then
    raise exception using errcode = 'P0001', message = 'conversation_blocked';
  end if;

  select m.id, m.chat_id, m.body, m.created_at
  into v_message_id, v_message_chat_id, v_result_body, v_message_created_at
  from public.messages m
  where m.sender_id = v_user_id
    and m.client_request_id = p_client_request_id;

  if found then
    if v_message_chat_id is distinct from p_chat_id then
      raise exception using errcode = 'P0001', message = 'request_id_conflict';
    end if;

    return query
      select v_message_id, v_result_body, v_message_created_at;
    return;
  end if;

  select rate.allowed, rate.retry_after_seconds
  into v_allowed, v_retry_after
  from public.consume_action_rate_limit('chat_message', 60, 20) rate;

  if not coalesce(v_allowed, false) then
    raise exception using
      errcode = 'P0001',
      message = 'message_rate_limited',
      hint = greatest(coalesce(v_retry_after, 60), 1)::text;
  end if;

  insert into public.messages (
    chat_id,
    sender_id,
    body,
    client_request_id
  )
  values (
    p_chat_id,
    v_user_id,
    v_validated_body,
    p_client_request_id
  )
  on conflict (sender_id, client_request_id)
    where client_request_id is not null
    do nothing
  returning id, body, created_at
  into v_message_id, v_result_body, v_message_created_at;

  if v_message_id is null then
    select m.id, m.chat_id, m.body, m.created_at
    into v_message_id, v_message_chat_id, v_result_body, v_message_created_at
    from public.messages m
    where m.sender_id = v_user_id
      and m.client_request_id = p_client_request_id;

    if v_message_chat_id is distinct from p_chat_id then
      raise exception using errcode = 'P0001', message = 'request_id_conflict';
    end if;
  end if;

  update public.chats
  set
    buyer_archived_at = case when buyer_id = v_user_id then null else buyer_archived_at end,
    seller_archived_at = case when seller_id = v_user_id then null else seller_archived_at end
  where id = p_chat_id;

  return query
    select v_message_id, v_result_body, v_message_created_at;
end;
$$;

revoke all on function public.start_chat_with_message(uuid, text, uuid)
  from public, anon;
revoke all on function public.send_chat_message(uuid, text, uuid)
  from public, anon;
grant execute on function public.start_chat_with_message(uuid, text, uuid)
  to authenticated;
grant execute on function public.send_chat_message(uuid, text, uuid)
  to authenticated;
