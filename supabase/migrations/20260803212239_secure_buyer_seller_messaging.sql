-- Phase 5: secure, listing-scoped buyer/seller messaging (applied version).
-- This migration keeps the existing chats/messages model and hardens its write surface.

alter table public.messages
  add column if not exists client_request_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_body_length_check'
  ) then
    alter table public.messages
      add constraint messages_body_length_check
      check (char_length(btrim(body)) between 1 and 2000);
  end if;
end
$$;

create unique index if not exists messages_sender_request_unique_idx
  on public.messages (sender_id, client_request_id)
  where client_request_id is not null;

create index if not exists idx_messages_chat_created_id
  on public.messages (chat_id, created_at desc, id desc);

-- A previous hotfix used an unqualified seller_id inside the listing subquery.
-- PostgreSQL resolved it to l.seller_id, turning the ownership comparison into
-- l.seller_id = l.seller_id. Keep the policy as defense in depth even though
-- direct chat inserts are revoked below.
drop policy if exists "buyers can create chats for themselves" on public.chats;
create policy "buyers can create chats for themselves"
on public.chats
for insert
to authenticated
with check (
  buyer_id = (select auth.uid())
  and buyer_id <> seller_id
  and exists (
    select 1
    from public.listings l
    join public.profiles seller_profile on seller_profile.id = l.seller_id
    where l.id = chats.listing_id
      and l.seller_id = chats.seller_id
      and l.status = 'active'
      and not seller_profile.is_suspended
  )
  and not exists (
    select 1
    from public.user_blocks block_row
    where
      (block_row.blocker_id = chats.buyer_id and block_row.blocked_id = chats.seller_id)
      or
      (block_row.blocker_id = chats.seller_id and block_row.blocked_id = chats.buyer_id)
  )
);

drop policy if exists "participants can insert messages" on public.messages;
create policy "participants can insert messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and char_length(btrim(body)) between 1 and 2000
  and exists (
    select 1
    from public.chats c
    join public.listings l on l.id = c.listing_id
    where c.id = messages.chat_id
      and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.seller_id)
      and l.status in ('active', 'reserved', 'sold')
  )
  and not exists (
    select 1
    from public.profiles current_profile
    where current_profile.id = (select auth.uid())
      and current_profile.is_suspended
  )
  and not exists (
    select 1
    from public.chats c
    join public.user_blocks block_row
      on
        (block_row.blocker_id = c.buyer_id and block_row.blocked_id = c.seller_id)
        or
        (block_row.blocker_id = c.seller_id and block_row.blocked_id = c.buyer_id)
    where c.id = messages.chat_id
  )
);

-- Existing conversation history remains available after the listing becomes
-- non-public. The listing page still applies its own public visibility rules.
drop policy if exists "chat participants can read linked listings" on public.listings;
create policy "chat participants can read linked listings"
on public.listings
for select
to authenticated
using (
  exists (
    select 1
    from public.chats c
    where c.listing_id = listings.id
      and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.seller_id)
  )
);

-- A blocked user may read only block rows that directly involve them. This
-- lets the server and database enforce messaging restrictions in both directions.
drop policy if exists "involved users can read blocks" on public.user_blocks;
create policy "involved users can read blocks"
on public.user_blocks
for select
to authenticated
using (
  blocker_id = (select auth.uid())
  or blocked_id = (select auth.uid())
);

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
  v_message_body text;
  v_message_created_at timestamp with time zone;
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_buyer_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  v_message_body := btrim(coalesce(p_body, ''));
  if char_length(v_message_body) < 1 then
    raise exception using errcode = 'P0001', message = 'message_empty';
  end if;
  if char_length(v_message_body) > 2000 then
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

  -- Return the committed result of a retried request without creating a duplicate.
  select m.id, m.chat_id, m.body, m.created_at
  into v_message_id, v_message_chat_id, v_message_body, v_message_created_at
  from public.messages m
  join public.chats c on c.id = m.chat_id
  where m.sender_id = v_buyer_id
    and m.client_request_id = p_client_request_id
    and c.listing_id = p_listing_id
    and c.buyer_id = v_buyer_id
    and c.seller_id = v_seller_id;

  if found then
    return query
      select v_message_chat_id, v_message_id, v_message_body, v_message_created_at;
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
    v_message_body,
    p_client_request_id
  )
  on conflict (sender_id, client_request_id)
    where client_request_id is not null
    do nothing
  returning id, body, created_at
  into v_message_id, v_message_body, v_message_created_at;

  if v_message_id is null then
    select m.id, m.chat_id, m.body, m.created_at
    into v_message_id, v_message_chat_id, v_message_body, v_message_created_at
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
    select v_chat_id, v_message_id, v_message_body, v_message_created_at;
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
  v_message_body text;
  v_message_created_at timestamp with time zone;
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  v_message_body := btrim(coalesce(p_body, ''));
  if char_length(v_message_body) < 1 then
    raise exception using errcode = 'P0001', message = 'message_empty';
  end if;
  if char_length(v_message_body) > 2000 then
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
  into v_message_id, v_message_chat_id, v_message_body, v_message_created_at
  from public.messages m
  where m.sender_id = v_user_id
    and m.client_request_id = p_client_request_id;

  if found then
    if v_message_chat_id is distinct from p_chat_id then
      raise exception using errcode = 'P0001', message = 'request_id_conflict';
    end if;

    return query
      select v_message_id, v_message_body, v_message_created_at;
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
    v_message_body,
    p_client_request_id
  )
  on conflict (sender_id, client_request_id)
    where client_request_id is not null
    do nothing
  returning id, body, created_at
  into v_message_id, v_message_body, v_message_created_at;

  if v_message_id is null then
    select m.id, m.chat_id, m.body, m.created_at
    into v_message_id, v_message_chat_id, v_message_body, v_message_created_at
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
    select v_message_id, v_message_body, v_message_created_at;
end;
$$;

create or replace function public.mark_chat_read(p_chat_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  update public.chats
  set
    buyer_last_read_at = case when buyer_id = v_user_id then now() else buyer_last_read_at end,
    seller_last_read_at = case when seller_id = v_user_id then now() else seller_last_read_at end
  where id = p_chat_id
    and (buyer_id = v_user_id or seller_id = v_user_id);

  v_updated := found;
  return v_updated;
end;
$$;

create or replace function public.set_chat_archived(
  p_chat_id uuid,
  p_archived boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated boolean;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  update public.chats
  set
    buyer_archived_at = case
      when buyer_id = v_user_id then case when p_archived then now() else null end
      else buyer_archived_at
    end,
    seller_archived_at = case
      when seller_id = v_user_id then case when p_archived then now() else null end
      else seller_archived_at
    end
  where id = p_chat_id
    and (buyer_id = v_user_id or seller_id = v_user_id);

  v_updated := found;
  return v_updated;
end;
$$;

-- The write surface is now the four narrow RPCs above. Remove dangerous
-- default privileges such as TRUNCATE/DELETE/REFERENCES from browser roles.
revoke all on table public.chats from anon;
revoke all on table public.messages from anon;
revoke all on table public.chats from authenticated;
revoke all on table public.messages from authenticated;

grant select on table public.chats to authenticated;
grant select on table public.messages to authenticated;

revoke all on function public.start_chat_with_message(uuid, text, uuid) from public, anon;
revoke all on function public.send_chat_message(uuid, text, uuid) from public, anon;
revoke all on function public.mark_chat_read(uuid) from public, anon;
revoke all on function public.set_chat_archived(uuid, boolean) from public, anon;

grant execute on function public.start_chat_with_message(uuid, text, uuid) to authenticated;
grant execute on function public.send_chat_message(uuid, text, uuid) to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.set_chat_archived(uuid, boolean) to authenticated;

revoke execute on function public.handle_new_message_metadata() from public, anon, authenticated;

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
  case when (select auth.uid()) = c.buyer_id then c.seller_id else c.buyer_id end as counterparty_id,
  case when (select auth.uid()) = c.buyer_id then seller.username else buyer.username end as counterparty_username,
  case when (select auth.uid()) = c.buyer_id then seller.full_name else buyer.full_name end as counterparty_full_name,
  case when (select auth.uid()) = c.buyer_id then seller.city else buyer.city end as counterparty_city,
  lm.body as last_message_body,
  lm.sender_id as last_message_sender_id,
  lm.created_at as last_message_created_at,
  case
    when (select auth.uid()) = c.buyer_id then (
      select count(*)::int
      from public.messages m
      where m.chat_id = c.id
        and m.sender_id <> (select auth.uid())
        and m.created_at > coalesce(c.buyer_last_read_at, to_timestamp(0))
    )
    else (
      select count(*)::int
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
  case when (select auth.uid()) = c.buyer_id then seller.avatar_url else buyer.avatar_url end as counterparty_avatar_url
from public.chats c
join public.listings l on l.id = c.listing_id
left join public.profiles buyer on buyer.id = c.buyer_id
left join public.profiles seller on seller.id = c.seller_id
left join lateral (
  select li.image_url
  from public.listing_images li
  where li.listing_id = l.id
  order by li.sort_order asc, li.created_at asc
  limit 1
) img on true
left join lateral (
  select m.body, m.sender_id, m.created_at
  from public.messages m
  where m.chat_id = c.id
  order by m.created_at desc, m.id desc
  limit 1
) lm on true
where c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid());

revoke all on table public.chat_threads from anon;
grant select on table public.chat_threads to authenticated;
