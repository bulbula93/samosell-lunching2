alter table public.chats
  add column if not exists buyer_archived_at timestamp with time zone,
  add column if not exists seller_archived_at timestamp with time zone;

create index if not exists idx_chats_buyer_archived_at
  on public.chats (buyer_id, buyer_archived_at);

create index if not exists idx_chats_seller_archived_at
  on public.chats (seller_id, seller_archived_at);

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
  case when auth.uid() = c.buyer_id then c.seller_id else c.buyer_id end as counterparty_id,
  case when auth.uid() = c.buyer_id then seller.username else buyer.username end as counterparty_username,
  case when auth.uid() = c.buyer_id then seller.full_name else buyer.full_name end as counterparty_full_name,
  case when auth.uid() = c.buyer_id then seller.city else buyer.city end as counterparty_city,
  lm.body as last_message_body,
  lm.sender_id as last_message_sender_id,
  lm.created_at as last_message_created_at,
  case
    when auth.uid() = c.buyer_id then (
      select count(*)::int
      from public.messages m
      where m.chat_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(c.buyer_last_read_at, to_timestamp(0))
    )
    else (
      select count(*)::int
      from public.messages m
      where m.chat_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(c.seller_last_read_at, to_timestamp(0))
    )
  end as unread_count,
  greatest(coalesce(c.last_message_at, c.created_at), c.created_at) as sort_at,
  case
    when auth.uid() = c.buyer_id then c.buyer_archived_at is not null
    else c.seller_archived_at is not null
  end as is_archived
from public.chats c
join public.listings l on l.id = c.listing_id
left join public.profiles buyer on buyer.id = c.buyer_id
left join public.profiles seller on seller.id = c.seller_id
left join lateral (
  select image_url
  from public.listing_images li
  where li.listing_id = l.id
  order by li.sort_order asc, li.created_at asc
  limit 1
) img on true
left join lateral (
  select m.body, m.sender_id, m.created_at
  from public.messages m
  where m.chat_id = c.id
  order by m.created_at desc
  limit 1
) lm on true
where c.buyer_id = auth.uid() or c.seller_id = auth.uid();

grant select on public.chat_threads to authenticated;
