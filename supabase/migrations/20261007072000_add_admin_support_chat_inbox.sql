-- Shared Admin Support Inbox for official SamoSell Help conversations.
-- Ordinary user-to-user chats remain participant-only.

drop policy if exists "admins can read support chats" on public.chats;
create policy "admins can read support chats"
on public.chats
for select
to authenticated
using (
  chat_type = 'support'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_admin
      and not p.is_suspended
  )
);

drop policy if exists "admins can read support messages" on public.messages;
create policy "admins can read support messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.chats c
    where c.id = public.messages.chat_id
      and c.chat_type = 'support'
      and exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.is_admin
          and not p.is_suspended
      )
  )
);

create index if not exists chats_support_activity_idx
  on public.chats (last_message_at desc, created_at desc)
  where chat_type = 'support';

create or replace view public.chat_threads
with (security_invoker = true) as
select
  c.id,
  c.listing_id,
  c.buyer_id,
  c.seller_id,
  c.created_at,
  c.last_message_at,
  c.buyer_last_read_at,
  c.seller_last_read_at,
  l.slug as listing_slug,
  l.title as listing_title,
  l.price,
  l.currency,
  l.status as listing_status,
  coalesce(l.cover_image_url, img.image_url) as cover_image_url,
  case
    when (select auth.uid()) = c.buyer_id then c.seller_id
    else c.buyer_id
  end as counterparty_id,
  case
    when (select auth.uid()) = c.buyer_id then seller.username
    else buyer.username
  end as counterparty_username,
  case
    when (select auth.uid()) = c.buyer_id then seller.full_name
    else buyer.full_name
  end as counterparty_full_name,
  case
    when (select auth.uid()) = c.buyer_id then seller.city
    else buyer.city
  end as counterparty_city,
  lm.body as last_message_body,
  lm.sender_id as last_message_sender_id,
  lm.created_at as last_message_created_at,
  case
    when c.chat_type = 'support'
      and exists (
        select 1
        from public.profiles admin_profile
        where admin_profile.id = (select auth.uid())
          and admin_profile.is_admin
          and not admin_profile.is_suspended
      )
      then (
        select count(*)::integer
        from public.messages m
        where m.chat_id = c.id
          and m.sender_id = c.buyer_id
          and m.created_at > coalesce(c.seller_last_read_at, to_timestamp(0))
      )
    when (select auth.uid()) = c.buyer_id
      then (
        select count(*)::integer
        from public.messages m
        where m.chat_id = c.id
          and m.sender_id <> (select auth.uid())
          and m.created_at > coalesce(c.buyer_last_read_at, to_timestamp(0))
      )
    else (
      select count(*)::integer
      from public.messages m
      where m.chat_id = c.id
        and m.sender_id <> (select auth.uid())
        and m.created_at > coalesce(c.seller_last_read_at, to_timestamp(0))
    )
  end as unread_count,
  greatest(coalesce(c.last_message_at, c.created_at), c.created_at) as sort_at,
  case
    when (select auth.uid()) = c.buyer_id then c.buyer_archived_at is not null
    else c.seller_archived_at is not null
  end as is_archived,
  case
    when (select auth.uid()) = c.buyer_id then seller.avatar_url
    else buyer.avatar_url
  end as counterparty_avatar_url,
  c.chat_type
from public.chats c
left join public.listings l on l.id = c.listing_id
left join public.profiles buyer on buyer.id = c.buyer_id
left join public.profiles seller on seller.id = c.seller_id
left join lateral (
  select li.image_url
  from public.listing_images li
  where li.listing_id = l.id
  order by li.sort_order, li.created_at
  limit 1
) img on true
left join lateral (
  select m.body, m.sender_id, m.created_at
  from public.messages m
  where m.chat_id = c.id
  order by m.created_at desc, m.id desc
  limit 1
) lm on true
where
  c.buyer_id = (select auth.uid())
  or c.seller_id = (select auth.uid())
  or (
    c.chat_type = 'support'
    and exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = (select auth.uid())
        and admin_profile.is_admin
        and not admin_profile.is_suspended
    )
  );

revoke all on table public.chat_threads from anon, authenticated;
grant select on table public.chat_threads to authenticated;

create or replace function public.admin_mark_support_chat_read(p_chat_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.is_admin
      and not p.is_suspended
  ) then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;

  update public.chats
  set
    seller_last_read_at = clock_timestamp(),
    seller_archived_at = null
  where id = p_chat_id
    and chat_type = 'support';

  return found;
end;
$$;

revoke all on function public.admin_mark_support_chat_read(uuid) from public, anon;
grant execute on function public.admin_mark_support_chat_read(uuid) to authenticated;

create or replace function public.admin_send_support_message(
  p_chat_id uuid,
  p_body text,
  p_client_request_id uuid
)
returns table(
  message_id uuid,
  message_body text,
  message_created_at timestamptz,
  recipient_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recipient_id uuid;
  v_message_id uuid;
  v_existing_chat_id uuid;
  v_result_body text;
  v_created_at timestamptz;
  v_body text := btrim(coalesce(p_body, ''));
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and p.is_admin
      and not p.is_suspended
  ) then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;

  if char_length(v_body) < 1 then
    raise exception using errcode = 'P0001', message = 'message_empty';
  end if;
  if char_length(v_body) > 2000 then
    raise exception using errcode = 'P0001', message = 'message_too_long';
  end if;
  if p_client_request_id is null then
    raise exception using errcode = 'P0001', message = 'request_id_required';
  end if;

  select c.buyer_id
    into v_recipient_id
  from public.chats c
  where c.id = p_chat_id
    and c.chat_type = 'support';

  if v_recipient_id is null then
    raise exception using errcode = 'P0001', message = 'conversation_not_found';
  end if;

  select m.id, m.chat_id, m.body, m.created_at
    into v_message_id, v_existing_chat_id, v_result_body, v_created_at
  from public.messages m
  where m.sender_id = v_user_id
    and m.client_request_id = p_client_request_id;

  if found then
    if v_existing_chat_id is distinct from p_chat_id then
      raise exception using errcode = 'P0001', message = 'request_id_conflict';
    end if;

    return query
      select v_message_id, v_result_body, v_created_at, v_recipient_id;
    return;
  end if;

  select r.allowed, r.retry_after_seconds
    into v_allowed, v_retry_after
  from public.consume_action_rate_limit('chat_message', 60, 30) r;

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
    client_request_id,
    message_type,
    story_id
  )
  values (
    p_chat_id,
    v_user_id,
    v_body,
    p_client_request_id,
    'text',
    null
  )
  on conflict (sender_id, client_request_id)
    where client_request_id is not null
    do nothing
  returning id, body, created_at
    into v_message_id, v_result_body, v_created_at;

  if v_message_id is null then
    select m.id, m.chat_id, m.body, m.created_at
      into v_message_id, v_existing_chat_id, v_result_body, v_created_at
    from public.messages m
    where m.sender_id = v_user_id
      and m.client_request_id = p_client_request_id;

    if v_existing_chat_id is distinct from p_chat_id then
      raise exception using errcode = 'P0001', message = 'request_id_conflict';
    end if;
  end if;

  update public.chats
  set
    seller_last_read_at = clock_timestamp(),
    seller_archived_at = null
  where id = p_chat_id
    and chat_type = 'support';

  return query
    select v_message_id, v_result_body, v_created_at, v_recipient_id;
end;
$$;

revoke all on function public.admin_send_support_message(uuid,text,uuid) from public, anon;
grant execute on function public.admin_send_support_message(uuid,text,uuid) to authenticated;

notify pgrst, 'reload schema';
