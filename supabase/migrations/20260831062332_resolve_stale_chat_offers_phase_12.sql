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
