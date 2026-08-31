alter table public.listings
  add column if not exists reserved_for_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists reserved_at timestamptz;

create index if not exists listings_reserved_for_user_idx
  on public.listings (reserved_for_user_id, reserved_at desc)
  where status = 'reserved' and reserved_for_user_id is not null;

alter table public.listings
  drop constraint if exists listings_reserved_buyer_not_seller;
alter table public.listings
  add constraint listings_reserved_buyer_not_seller
  check (reserved_for_user_id is null or reserved_for_user_id <> seller_id);

create or replace function public.sync_listing_reservation_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'reserved' then
    new.reserved_for_user_id := null;
    new.reserved_at := null;
    return new;
  end if;

  if new.reserved_for_user_id is null then
    new.reserved_at := null;
    return new;
  end if;

  if new.reserved_for_user_id = new.seller_id then
    raise exception using errcode = '22023', message = 'invalid_reservation_buyer';
  end if;

  if tg_op = 'INSERT'
    or old.status is distinct from new.status
    or old.reserved_for_user_id is distinct from new.reserved_for_user_id
  then
    new.reserved_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.sync_listing_reservation_state() from public, anon, authenticated;

drop trigger if exists listings_sync_reservation_state on public.listings;
create trigger listings_sync_reservation_state
before insert or update of status, reserved_for_user_id, seller_id
on public.listings
for each row execute function public.sync_listing_reservation_state();

create table if not exists public.chat_offers (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'GEL' check (currency = 'GEL'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'released', 'completed')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create unique index if not exists chat_offers_one_pending_per_chat_idx
  on public.chat_offers(chat_id)
  where status = 'pending';

create index if not exists chat_offers_chat_created_idx
  on public.chat_offers(chat_id, created_at desc);
create index if not exists chat_offers_listing_status_idx
  on public.chat_offers(listing_id, status, created_at desc);
create index if not exists chat_offers_buyer_created_idx
  on public.chat_offers(buyer_id, created_at desc);
create index if not exists chat_offers_seller_created_idx
  on public.chat_offers(seller_id, created_at desc);

drop trigger if exists set_chat_offers_updated_at on public.chat_offers;
create trigger set_chat_offers_updated_at
before update on public.chat_offers
for each row execute function public.set_updated_at();

alter table public.chat_offers enable row level security;
revoke all on table public.chat_offers from public, anon, authenticated;
grant select on table public.chat_offers to authenticated;

drop policy if exists chat_offers_select_participants on public.chat_offers;
create policy chat_offers_select_participants
on public.chat_offers
for select
to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid());

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

  if exists (
    select 1 from public.profiles p
    where p.id = v_actor and p.is_suspended
  ) then
    raise exception using errcode = 'P0001', message = 'account_suspended';
  end if;

  select c.* into v_chat
  from public.chats c
  where c.id = p_chat_id and c.buyer_id = v_actor
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'offer_not_allowed';
  end if;

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

  update public.chat_offers
  set status = 'rejected', responded_at = now()
  where listing_id = v_listing.id and status = 'pending' and buyer_id <> v_chat.buyer_id;

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

  update public.chat_offers
  set status = 'completed', responded_at = coalesce(responded_at, now())
  where listing_id = v_listing.id and buyer_id = v_chat.buyer_id and status = 'accepted';

  return jsonb_build_object('status', v_listing.status, 'sold_to_user_id', v_listing.sold_to_user_id, 'listing_slug', v_listing.slug);
end;
$$;

revoke all on function public.complete_chat_sale(uuid) from public, anon;
grant execute on function public.complete_chat_sale(uuid) to authenticated;

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
    or (p_action = 'order_status_update' and p_window_seconds = 600 and p_max_hits = 30)
    or (p_action = 'chat_start' and p_window_seconds = 600 and p_max_hits = 20)
    or (p_action = 'chat_message' and p_window_seconds = 60 and p_max_hits = 20)
    or (p_action = 'chat_commerce' and p_window_seconds = 600 and p_max_hits = 20)
    or (p_action = 'listing_report' and p_window_seconds = 3600 and p_max_hits = 10)
  ) then
    raise exception using errcode = 'P0001', message = 'bad_rate_limit_arguments';
  end if;

  insert into public.user_action_rate_limits (user_id, action, window_started_at, hits)
  values (v_user_id, p_action, v_now, 0)
  on conflict (user_id, action) do nothing;

  select * into v_row
  from public.user_action_rate_limits
  where user_id = v_user_id and action = p_action
  for update;

  v_reset_at := v_row.window_started_at + make_interval(secs => p_window_seconds);

  if v_now >= v_reset_at then
    update public.user_action_rate_limits
    set window_started_at = v_now, hits = 1
    where user_id = v_user_id and action = p_action;
    return query select true, 1, p_max_hits, 0;
    return;
  end if;

  if v_row.hits < p_max_hits then
    update public.user_action_rate_limits
    set hits = v_row.hits + 1
    where user_id = v_user_id and action = p_action;
    return query select true, v_row.hits + 1, p_max_hits,
      greatest(0, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
    return;
  end if;

  return query select false, v_row.hits, p_max_hits,
    greatest(0, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
end;
$$;

revoke all on function public.consume_action_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_action_rate_limit(text, integer, integer) to authenticated;
