create or replace function private.assert_chat_commerce_allowed(
  p_actor_id uuid,
  p_buyer_id uuid,
  p_seller_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_actor_id and p.is_suspended
  ) then
    raise exception using errcode = 'P0001', message = 'account_suspended';
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = p_buyer_id and b.blocked_id = p_seller_id)
       or (b.blocker_id = p_seller_id and b.blocked_id = p_buyer_id)
  ) then
    raise exception using errcode = 'P0001', message = 'conversation_blocked';
  end if;
end;
$$;

revoke all on function private.assert_chat_commerce_allowed(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.create_chat_offer(p_chat_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_chat public.chats%rowtype;
  v_listing public.listings%rowtype;
  v_offer public.chat_offers%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if p_chat_id is null or p_amount is null then
    raise exception using errcode = '22023', message = 'invalid_offer';
  end if;

  select c.* into v_chat
  from public.chats c
  where c.id = p_chat_id and c.buyer_id = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'offer_not_allowed';
  end if;

  perform private.assert_chat_commerce_allowed(v_actor, v_chat.buyer_id, v_chat.seller_id);

  select l.* into v_listing
  from public.listings l
  where l.id = v_chat.listing_id and l.seller_id = v_chat.seller_id
  for update;

  if not found or v_listing.status <> 'active' then
    raise exception using errcode = '22023', message = 'listing_unavailable';
  end if;

  if p_amount <= 0 or p_amount > v_listing.price then
    raise exception using errcode = '22023', message = 'invalid_offer_amount';
  end if;

  if not exists (
    select 1 from public.messages m
    where m.chat_id = v_chat.id and m.sender_id = v_actor
  ) then
    raise exception using errcode = '22023', message = 'buyer_message_required';
  end if;

  if exists (
    select 1 from public.chat_offers o
    where o.chat_id = v_chat.id
      and o.buyer_id = v_actor
      and o.created_at > now() - interval '30 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'offer_rate_limited';
  end if;

  update public.chat_offers
  set status = 'withdrawn', responded_at = now()
  where chat_id = v_chat.id and status = 'pending';

  insert into public.chat_offers (
    chat_id, listing_id, buyer_id, seller_id, amount, currency
  ) values (
    v_chat.id, v_listing.id, v_chat.buyer_id, v_chat.seller_id, round(p_amount, 2), 'GEL'
  ) returning * into v_offer;

  insert into public.notifications (
    user_id, type, title, body, href, actor_id, listing_id, chat_id, event_key, metadata
  ) values (
    v_chat.seller_id,
    'offer_created',
    'ახალი ფასის შეთავაზება',
    format('„%s“-ზე მყიდველმა შემოგთავაზა %s ₾.', v_listing.title, trim(to_char(v_offer.amount, 'FM999999990.00'))),
    '/dashboard/chats/' || v_chat.id,
    v_chat.buyer_id,
    v_listing.id,
    v_chat.id,
    'chat_offer:' || v_offer.id || ':created',
    jsonb_build_object('offer_id', v_offer.id, 'amount', v_offer.amount, 'currency', v_offer.currency)
  ) on conflict (event_key) do nothing;

  return jsonb_build_object(
    'id', v_offer.id,
    'status', v_offer.status,
    'amount', v_offer.amount,
    'currency', v_offer.currency,
    'created_at', v_offer.created_at
  );
end;
$$;

revoke all on function public.create_chat_offer(uuid, numeric) from public, anon;
grant execute on function public.create_chat_offer(uuid, numeric) to authenticated;

create or replace function public.respond_chat_offer(p_offer_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_offer public.chat_offers%rowtype;
  v_listing public.listings%rowtype;
  v_next_status text;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if p_offer_id is null or p_action not in ('accept', 'reject') then
    raise exception using errcode = '22023', message = 'invalid_offer_action';
  end if;

  select o.* into v_offer
  from public.chat_offers o
  where o.id = p_offer_id and o.seller_id = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'offer_not_found';
  end if;

  perform private.assert_chat_commerce_allowed(v_actor, v_offer.buyer_id, v_offer.seller_id);

  if v_offer.status <> 'pending' then
    raise exception using errcode = '22023', message = 'offer_already_resolved';
  end if;

  select l.* into v_listing
  from public.listings l
  where l.id = v_offer.listing_id and l.seller_id = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'listing_not_found';
  end if;

  if p_action = 'accept' then
    if v_listing.status <> 'active' then
      raise exception using errcode = '22023', message = 'listing_unavailable';
    end if;
    v_next_status := 'accepted';

    update public.chat_offers
    set status = 'rejected', responded_at = now()
    where listing_id = v_listing.id and status = 'pending' and id <> v_offer.id;

    update public.listings
    set status = 'reserved', reserved_for_user_id = v_offer.buyer_id
    where id = v_listing.id;
  else
    v_next_status := 'rejected';
  end if;

  update public.chat_offers
  set status = v_next_status, responded_at = now()
  where id = v_offer.id
  returning * into v_offer;

  insert into public.notifications (
    user_id, type, title, body, href, actor_id, listing_id, chat_id, event_key, metadata
  ) values (
    v_offer.buyer_id,
    case when v_next_status = 'accepted' then 'offer_accepted' else 'offer_rejected' end,
    case when v_next_status = 'accepted' then 'შეთავაზება მიღებულია' else 'შეთავაზება არ მიიღეს' end,
    case
      when v_next_status = 'accepted' then format('შენი %s ₾ შეთავაზება მიღებულია და ნივთი შენთვის დაიჯავშნა.', trim(to_char(v_offer.amount, 'FM999999990.00')))
      else format('შენი %s ₾ შეთავაზება გამყიდველმა არ მიიღო.', trim(to_char(v_offer.amount, 'FM999999990.00')))
    end,
    '/dashboard/chats/' || v_offer.chat_id,
    v_offer.seller_id,
    v_offer.listing_id,
    v_offer.chat_id,
    'chat_offer:' || v_offer.id || ':' || v_next_status,
    jsonb_build_object('offer_id', v_offer.id, 'amount', v_offer.amount, 'status', v_next_status)
  ) on conflict (event_key) do nothing;

  return jsonb_build_object(
    'id', v_offer.id,
    'status', v_offer.status,
    'amount', v_offer.amount,
    'currency', v_offer.currency,
    'responded_at', v_offer.responded_at
  );
end;
$$;

revoke all on function public.respond_chat_offer(uuid, text) from public, anon;
grant execute on function public.respond_chat_offer(uuid, text) to authenticated;

create or replace function public.reserve_chat_listing(p_chat_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_chat public.chats%rowtype;
  v_listing public.listings%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select c.* into v_chat
  from public.chats c
  where c.id = p_chat_id and c.seller_id = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'reservation_not_allowed';
  end if;

  perform private.assert_chat_commerce_allowed(v_actor, v_chat.buyer_id, v_chat.seller_id);

  if not exists (
    select 1 from public.profiles p where p.id = v_chat.buyer_id and not p.is_suspended
  ) or not exists (
    select 1 from public.messages m where m.chat_id = v_chat.id and m.sender_id = v_chat.buyer_id
  ) then
    raise exception using errcode = '22023', message = 'invalid_reservation_buyer';
  end if;

  select l.* into v_listing
  from public.listings l
  where l.id = v_chat.listing_id and l.seller_id = v_actor
  for update;

  if not found or v_listing.status <> 'active' then
    raise exception using errcode = '22023', message = 'listing_unavailable';
  end if;

  update public.listings
  set status = 'reserved', reserved_for_user_id = v_chat.buyer_id
  where id = v_listing.id
  returning * into v_listing;

  with changed as (
    update public.chat_offers o
    set
      status = case when o.buyer_id = v_chat.buyer_id then 'accepted' else 'rejected' end,
      responded_at = now()
    where o.listing_id = v_listing.id
      and o.status = 'pending'
    returning o.id, o.buyer_id, o.chat_id, o.amount, o.status
  )
  insert into public.notifications (
    user_id, type, title, body, href, actor_id, listing_id, chat_id, event_key, metadata
  )
  select
    changed.buyer_id,
    'offer_rejected',
    'შეთავაზება აღარ არის აქტიური',
    format('შენი %s ₾ შეთავაზება აღარ არის აქტიური — ნივთი სხვა მყიდველისთვის დაიჯავშნა.', trim(to_char(changed.amount, 'FM999999990.00'))),
    '/dashboard/chats/' || changed.chat_id,
    v_actor,
    v_listing.id,
    changed.chat_id,
    'chat_offer:' || changed.id || ':rejected',
    jsonb_build_object('offer_id', changed.id, 'amount', changed.amount, 'status', 'rejected', 'reason', 'reserved_for_another_buyer')
  from changed
  where changed.buyer_id <> v_chat.buyer_id
  on conflict (event_key) do nothing;

  insert into public.notifications (
    user_id, type, title, body, href, actor_id, listing_id, chat_id, event_key, metadata
  ) values (
    v_chat.buyer_id,
    'reservation_created',
    'ნივთი შენთვის დაიჯავშნა',
    format('„%s“ გამყიდველმა შენთვის დაჯავშნა.', v_listing.title),
    '/dashboard/chats/' || v_chat.id,
    v_actor,
    v_listing.id,
    v_chat.id,
    'chat_reservation:' || v_listing.id || ':' || v_chat.buyer_id || ':' || extract(epoch from v_listing.reserved_at)::bigint,
    jsonb_build_object('status', 'reserved', 'reserved_at', v_listing.reserved_at)
  );

  return jsonb_build_object('status', v_listing.status, 'reserved_for_user_id', v_listing.reserved_for_user_id, 'reserved_at', v_listing.reserved_at);
end;
$$;

revoke all on function public.reserve_chat_listing(uuid) from public, anon;
grant execute on function public.reserve_chat_listing(uuid) to authenticated;

create or replace function public.release_chat_reservation(p_chat_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_chat public.chats%rowtype;
  v_listing public.listings%rowtype;
  v_reserved_at timestamptz;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select c.* into v_chat
  from public.chats c
  where c.id = p_chat_id and c.seller_id = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'reservation_not_allowed';
  end if;

  perform private.assert_chat_commerce_allowed(v_actor, v_chat.buyer_id, v_chat.seller_id);

  select l.* into v_listing
  from public.listings l
  where l.id = v_chat.listing_id and l.seller_id = v_actor
  for update;

  if not found or v_listing.status <> 'reserved' or v_listing.reserved_for_user_id is distinct from v_chat.buyer_id then
    raise exception using errcode = '22023', message = 'reservation_not_found';
  end if;

  v_reserved_at := v_listing.reserved_at;

  update public.chat_offers
  set status = 'released', responded_at = now()
  where listing_id = v_listing.id and buyer_id = v_chat.buyer_id and status = 'accepted';

  update public.listings
  set status = 'active'
  where id = v_listing.id
  returning * into v_listing;

  insert into public.notifications (
    user_id, type, title, body, href, actor_id, listing_id, chat_id, event_key, metadata
  ) values (
    v_chat.buyer_id,
    'reservation_released',
    'ჯავშანი მოიხსნა',
    format('„%s“-ზე ჯავშანი აღარ არის აქტიური.', v_listing.title),
    '/dashboard/chats/' || v_chat.id,
    v_actor,
    v_listing.id,
    v_chat.id,
    'chat_reservation_release:' || v_listing.id || ':' || v_chat.buyer_id || ':' || coalesce(extract(epoch from v_reserved_at)::bigint, extract(epoch from now())::bigint),
    jsonb_build_object('status', 'released')
  );

  return jsonb_build_object('status', v_listing.status, 'reserved_for_user_id', v_listing.reserved_for_user_id, 'reserved_at', v_listing.reserved_at);
end;
$$;

revoke all on function public.release_chat_reservation(uuid) from public, anon;
grant execute on function public.release_chat_reservation(uuid) to authenticated;

create or replace function public.complete_chat_sale(p_chat_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_chat public.chats%rowtype;
  v_listing public.listings%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  select c.* into v_chat
  from public.chats c
  where c.id = p_chat_id and c.seller_id = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'sale_not_allowed';
  end if;

  perform private.assert_chat_commerce_allowed(v_actor, v_chat.buyer_id, v_chat.seller_id);

  select l.* into v_listing
  from public.listings l
  where l.id = v_chat.listing_id and l.seller_id = v_actor
  for update;

  if not found or v_listing.status not in ('active', 'reserved') then
    raise exception using errcode = '22023', message = 'listing_unavailable';
  end if;

  if v_listing.status = 'reserved'
    and v_listing.reserved_for_user_id is not null
    and v_listing.reserved_for_user_id <> v_chat.buyer_id
  then
    raise exception using errcode = '22023', message = 'reserved_for_other_buyer';
  end if;

  update public.listings
  set status = 'sold', sold_to_user_id = v_chat.buyer_id
  where id = v_listing.id
  returning * into v_listing;

  with changed as (
    update public.chat_offers o
    set
      status = case when o.buyer_id = v_chat.buyer_id then 'completed' else 'rejected' end,
      responded_at = coalesce(o.responded_at, now())
    where o.listing_id = v_listing.id
      and o.status in ('pending', 'accepted')
    returning o.id, o.buyer_id, o.chat_id, o.amount, o.status
  )
  insert into public.notifications (
    user_id, type, title, body, href, actor_id, listing_id, chat_id, event_key, metadata
  )
  select
    changed.buyer_id,
    'offer_rejected',
    'შეთავაზება აღარ არის აქტიური',
    format('შენი %s ₾ შეთავაზება აღარ არის აქტიური — ნივთი გაიყიდა.', trim(to_char(changed.amount, 'FM999999990.00'))),
    '/dashboard/chats/' || changed.chat_id,
    v_actor,
    v_listing.id,
    changed.chat_id,
    'chat_offer:' || changed.id || ':rejected',
    jsonb_build_object('offer_id', changed.id, 'amount', changed.amount, 'status', 'rejected', 'reason', 'listing_sold')
  from changed
  where changed.buyer_id <> v_chat.buyer_id
  on conflict (event_key) do nothing;

  return jsonb_build_object('status', v_listing.status, 'sold_to_user_id', v_listing.sold_to_user_id, 'listing_slug', v_listing.slug);
end;
$$;

revoke all on function public.complete_chat_sale(uuid) from public, anon;
grant execute on function public.complete_chat_sale(uuid) to authenticated;
