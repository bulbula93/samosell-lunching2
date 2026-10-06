-- SamoSell Welcome / Help chat.
-- Reuses the existing chat, message, realtime and notification infrastructure,
-- while keeping official support separate from ordinary direct conversations.

alter table public.chats
  drop constraint if exists chats_type_integrity_check;

alter table public.chats
  add constraint chats_type_integrity_check check (
    (chat_type = 'listing' and listing_id is not null)
    or (chat_type in ('direct', 'support') and listing_id is null)
  );

create unique index if not exists chats_support_buyer_unique_idx
  on public.chats (buyer_id)
  where chat_type = 'support';

create or replace function public.create_welcome_support_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_support_admin_id uuid;
  v_chat_id uuid;
  v_message_id uuid;
  v_welcome_body text := '👋 გამარჯობა!

მადლობა, რომ შემოუერთდი SamoSell-ს 💛

აქ შეგიძლია მარტივად გაყიდო ნივთები, რომლებიც აღარ გჭირდება — ტანსაცმელი, ფეხსაცმელი, აქსესუარები, პარფიუმერია და სხვა.

📸 როგორ გაყიდო უფრო სწრაფად?
• ატვირთე ნათელი და ხარისხიანი ფოტოები
• აღწერე ნივთის რეალური მდგომარეობა
• მიუთითე სამართლიანი ფასი
• სწრაფად უპასუხე დაინტერესებულ ადამიანებს ჩათში 💬

✨ პატარა რჩევა: რამდენიმე განცხადების დამატება ზრდის შანსს, რომ შენი ნივთები უფრო მეტმა ადამიანმა ნახოს.

თუ რამე კითხვა გაქვს ან დახმარება დაგჭირდება, მოგვწერე პირდაპირ ამ ჩათში — SamoSell-ის გუნდი გიპასუხებს.

SamoSell გუნდი 💛';
begin
  -- Welcome/help delivery must never make account creation fail.
  begin
    select p.id
      into v_support_admin_id
    from public.profiles p
    where p.is_admin
      and not p.is_suspended
      and p.id <> new.id
    order by p.created_at asc, p.id asc
    limit 1;

    if v_support_admin_id is null then
      return new;
    end if;

    insert into public.chats (
      listing_id,
      buyer_id,
      seller_id,
      chat_type,
      buyer_last_read_at,
      seller_last_read_at
    )
    values (
      null,
      new.id,
      v_support_admin_id,
      'support',
      null,
      clock_timestamp()
    )
    on conflict (buyer_id) where chat_type = 'support'
      do nothing
    returning id into v_chat_id;

    if v_chat_id is null then
      select c.id
        into v_chat_id
      from public.chats c
      where c.chat_type = 'support'
        and c.buyer_id = new.id
      limit 1;
    end if;

    if v_chat_id is null then
      return new;
    end if;

    select m.id
      into v_message_id
    from public.messages m
    where m.chat_id = v_chat_id
      and m.sender_id = v_support_admin_id
      and m.body = v_welcome_body
    order by m.created_at asc
    limit 1;

    if v_message_id is null then
      insert into public.messages (
        chat_id,
        sender_id,
        body,
        message_type,
        story_id
      )
      values (
        v_chat_id,
        v_support_admin_id,
        v_welcome_body,
        'text',
        null
      )
      returning id into v_message_id;
    end if;

    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      href,
      actor_id,
      chat_id,
      event_key,
      metadata
    )
    values (
      new.id,
      'chat_message',
      'კეთილი იყოს შენი მობრძანება SamoSell-ში 💛',
      'SamoSell Help-ში დაგხვდა მოკლე გზამკვლევი და აქვე შეგიძლია დახმარებისთვის მოგვწერო.',
      '/dashboard/chats/' || v_chat_id::text,
      v_support_admin_id,
      v_chat_id,
      'support_welcome:' || new.id::text,
      jsonb_build_object(
        'message_id', v_message_id,
        'official_support', true,
        'welcome', true
      )
    )
    on conflict (event_key) do nothing;
  exception
    when others then
      raise warning 'welcome support chat skipped for profile %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.create_welcome_support_chat() from public, anon, authenticated;

drop trigger if exists profiles_create_welcome_support_chat on public.profiles;
create trigger profiles_create_welcome_support_chat
after insert on public.profiles
for each row
execute function public.create_welcome_support_chat();

-- General text messages can be sent inside support threads. Support stays
-- available even if marketplace blocking/suspension affects ordinary DMs.
create or replace function public.send_chat_message(
  p_chat_id uuid,
  p_body text,
  p_client_request_id uuid
)
returns table(
  message_id uuid,
  message_body text,
  message_created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_buyer_id uuid;
  v_seller_id uuid;
  v_chat_type text;
  v_listing_status text;
  v_message_id uuid;
  v_message_chat_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_result_body text;
  v_created_at timestamptz;
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception using errcode='P0001', message='not_authenticated';
  end if;
  if char_length(v_body) < 1 then
    raise exception using errcode='P0001', message='message_empty';
  end if;
  if char_length(v_body) > 2000 then
    raise exception using errcode='P0001', message='message_too_long';
  end if;
  if p_client_request_id is null then
    raise exception using errcode='P0001', message='request_id_required';
  end if;

  select c.buyer_id, c.seller_id, c.chat_type, l.status
    into v_buyer_id, v_seller_id, v_chat_type, v_listing_status
  from public.chats c
  left join public.listings l on l.id = c.listing_id
  where c.id = p_chat_id
    and (c.buyer_id = v_user_id or c.seller_id = v_user_id);

  if not found then
    raise exception using errcode='P0001', message='conversation_not_found';
  end if;
  if v_chat_type = 'listing' and v_listing_status not in ('active', 'reserved', 'sold') then
    raise exception using errcode='P0001', message='conversation_read_only';
  end if;
  if v_chat_type not in ('listing', 'direct', 'support') then
    raise exception using errcode='P0001', message='conversation_not_found';
  end if;
  if v_chat_type <> 'support'
     and exists(
       select 1
       from public.profiles p
       where p.id = v_user_id
         and p.is_suspended
     ) then
    raise exception using errcode='P0001', message='account_suspended';
  end if;
  if v_chat_type <> 'support'
     and exists(
       select 1
       from public.user_blocks b
       where (b.blocker_id = v_buyer_id and b.blocked_id = v_seller_id)
          or (b.blocker_id = v_seller_id and b.blocked_id = v_buyer_id)
     ) then
    raise exception using errcode='P0001', message='conversation_blocked';
  end if;

  select m.id, m.chat_id, m.body, m.created_at
    into v_message_id, v_message_chat_id, v_result_body, v_created_at
  from public.messages m
  where m.sender_id = v_user_id
    and m.client_request_id = p_client_request_id;

  if found then
    if v_message_chat_id is distinct from p_chat_id then
      raise exception using errcode='P0001', message='request_id_conflict';
    end if;
    return query
      select v_message_id, v_result_body, v_created_at;
    return;
  end if;

  select r.allowed, r.retry_after_seconds
    into v_allowed, v_retry_after
  from public.consume_action_rate_limit('chat_message', 60, 20) r;

  if not coalesce(v_allowed, false) then
    raise exception using
      errcode='P0001',
      message='message_rate_limited',
      hint=greatest(coalesce(v_retry_after, 60), 1)::text;
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
  on conflict(sender_id, client_request_id)
    where client_request_id is not null
    do nothing
  returning id, body, created_at
    into v_message_id, v_result_body, v_created_at;

  if v_message_id is null then
    select m.id, m.chat_id, m.body, m.created_at
      into v_message_id, v_message_chat_id, v_result_body, v_created_at
    from public.messages m
    where m.sender_id = v_user_id
      and m.client_request_id = p_client_request_id;

    if v_message_chat_id is distinct from p_chat_id then
      raise exception using errcode='P0001', message='request_id_conflict';
    end if;
  end if;

  update public.chats
  set
    buyer_archived_at = case when buyer_id = v_user_id then null else buyer_archived_at end,
    seller_archived_at = case when seller_id = v_user_id then null else seller_archived_at end
  where id = p_chat_id;

  return query
    select v_message_id, v_result_body, v_created_at;
end;
$$;

revoke all on function public.send_chat_message(uuid,text,uuid) from public, anon;
grant execute on function public.send_chat_message(uuid,text,uuid) to authenticated;

-- Support users can also attach screenshots using the existing private image flow.
create or replace function public.send_chat_image_message(
  p_chat_id uuid,
  p_body text,
  p_media_path text,
  p_mime_type text,
  p_media_size bigint,
  p_client_request_id uuid
)
returns table(
  message_id uuid,
  message_body text,
  message_created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_buyer_id uuid;
  v_seller_id uuid;
  v_chat_type text;
  v_listing_status text;
  v_message_id uuid;
  v_message_chat_id uuid;
  v_message_type text;
  v_message_media_path text;
  v_body text := btrim(coalesce(p_body, ''));
  v_result_body text;
  v_created_at timestamptz;
  v_allowed boolean;
  v_retry_after integer;
  v_path_pattern text;
begin
  if v_user_id is null then
    raise exception using errcode='P0001', message='not_authenticated';
  end if;
  if p_client_request_id is null then
    raise exception using errcode='P0001', message='request_id_required';
  end if;

  if char_length(v_body) < 1 then
    v_body := '📷 ფოტო';
  end if;
  if char_length(v_body) > 2000 then
    raise exception using errcode='P0001', message='message_too_long';
  end if;

  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception using errcode='P0001', message='chat_image_invalid_type';
  end if;
  if p_media_size is null or p_media_size < 1 or p_media_size > 8388608 then
    raise exception using errcode='P0001', message='chat_image_invalid_size';
  end if;
  if p_media_path is null or char_length(p_media_path) > 300 then
    raise exception using errcode='P0001', message='chat_image_invalid_path';
  end if;

  v_path_pattern := '^' || v_user_id::text || '/' || p_chat_id::text || '/[0-9a-f-]{36}[.](jpg|png|webp)$';
  if p_media_path !~* v_path_pattern then
    raise exception using errcode='P0001', message='chat_image_invalid_path';
  end if;
  if (p_mime_type='image/jpeg' and p_media_path !~* '[.]jpg$')
     or (p_mime_type='image/png' and p_media_path !~* '[.]png$')
     or (p_mime_type='image/webp' and p_media_path !~* '[.]webp$') then
    raise exception using errcode='P0001', message='chat_image_invalid_path';
  end if;

  select c.buyer_id, c.seller_id, c.chat_type, l.status
    into v_buyer_id, v_seller_id, v_chat_type, v_listing_status
  from public.chats c
  left join public.listings l on l.id = c.listing_id
  where c.id = p_chat_id
    and (c.buyer_id = v_user_id or c.seller_id = v_user_id);

  if not found then
    raise exception using errcode='P0001', message='conversation_not_found';
  end if;
  if v_chat_type='listing' and v_listing_status not in ('active','reserved','sold') then
    raise exception using errcode='P0001', message='conversation_read_only';
  end if;
  if v_chat_type not in ('listing','direct','support') then
    raise exception using errcode='P0001', message='conversation_not_found';
  end if;
  if v_chat_type <> 'support'
     and exists(select 1 from public.profiles p where p.id=v_user_id and p.is_suspended) then
    raise exception using errcode='P0001', message='account_suspended';
  end if;
  if v_chat_type <> 'support'
     and exists(
       select 1 from public.user_blocks b
       where (b.blocker_id=v_buyer_id and b.blocked_id=v_seller_id)
          or (b.blocker_id=v_seller_id and b.blocked_id=v_buyer_id)
     ) then
    raise exception using errcode='P0001', message='conversation_blocked';
  end if;

  if not exists(
    select 1
    from storage.objects o
    where o.bucket_id='chat-images' and o.name=p_media_path
  ) then
    raise exception using errcode='P0001', message='chat_image_missing';
  end if;

  select m.id, m.chat_id, m.message_type, m.media_path, m.body, m.created_at
    into v_message_id, v_message_chat_id, v_message_type, v_message_media_path, v_result_body, v_created_at
  from public.messages m
  where m.sender_id=v_user_id
    and m.client_request_id=p_client_request_id;

  if found then
    if v_message_chat_id is distinct from p_chat_id
       or v_message_type is distinct from 'image'
       or v_message_media_path is distinct from p_media_path then
      raise exception using errcode='P0001', message='request_id_conflict';
    end if;
    return query select v_message_id, v_result_body, v_created_at;
    return;
  end if;

  select r.allowed, r.retry_after_seconds
    into v_allowed, v_retry_after
  from public.consume_action_rate_limit('chat_message', 60, 20) r;

  if not coalesce(v_allowed, false) then
    raise exception using
      errcode='P0001',
      message='message_rate_limited',
      hint=greatest(coalesce(v_retry_after,60),1)::text;
  end if;

  insert into public.messages(
    chat_id,
    sender_id,
    body,
    client_request_id,
    message_type,
    story_id,
    media_path,
    media_mime_type,
    media_size
  )
  values(
    p_chat_id,
    v_user_id,
    v_body,
    p_client_request_id,
    'image',
    null,
    p_media_path,
    p_mime_type,
    p_media_size
  )
  on conflict(sender_id, client_request_id)
    where client_request_id is not null
    do nothing
  returning id, body, created_at
    into v_message_id, v_result_body, v_created_at;

  if v_message_id is null then
    select m.id, m.chat_id, m.message_type, m.media_path, m.body, m.created_at
      into v_message_id, v_message_chat_id, v_message_type, v_message_media_path, v_result_body, v_created_at
    from public.messages m
    where m.sender_id=v_user_id
      and m.client_request_id=p_client_request_id;

    if v_message_chat_id is distinct from p_chat_id
       or v_message_type is distinct from 'image'
       or v_message_media_path is distinct from p_media_path then
      raise exception using errcode='P0001', message='request_id_conflict';
    end if;
  end if;

  update public.chats
  set
    buyer_archived_at=case when buyer_id=v_user_id then null else buyer_archived_at end,
    seller_archived_at=case when seller_id=v_user_id then null else seller_archived_at end
  where id=p_chat_id;

  return query select v_message_id, v_result_body, v_created_at;
end;
$$;

revoke all on function public.send_chat_image_message(uuid,text,text,text,bigint,uuid) from public, anon;
grant execute on function public.send_chat_image_message(uuid,text,text,text,bigint,uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
