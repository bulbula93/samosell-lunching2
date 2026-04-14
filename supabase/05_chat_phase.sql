alter table public.chats
  add column if not exists buyer_last_read_at timestamp with time zone,
  add column if not exists seller_last_read_at timestamp with time zone;

create index if not exists idx_chats_buyer_last_message_at
  on public.chats (buyer_id, coalesce(last_message_at, created_at) desc);

create index if not exists idx_chats_seller_last_message_at
  on public.chats (seller_id, coalesce(last_message_at, created_at) desc);

create index if not exists idx_messages_chat_created_at
  on public.messages (chat_id, created_at desc);

drop policy if exists "buyers can create chats for themselves" on public.chats;
create policy "buyers can create chats for themselves"
on public.chats
for insert
to authenticated
with check (
  buyer_id = auth.uid()
  and buyer_id <> seller_id
  and exists (
    select 1
    from public.listings l
    where l.id = listing_id
      and l.seller_id = seller_id
      and l.status = 'active'
  )
);

create or replace function public.handle_new_message_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chats c
  set
    last_message_at = new.created_at,
    buyer_last_read_at = case when new.sender_id = c.buyer_id then new.created_at else c.buyer_last_read_at end,
    seller_last_read_at = case when new.sender_id = c.seller_id then new.created_at else c.seller_last_read_at end
  where c.id = new.chat_id;

  return new;
end;
$$;

drop trigger if exists on_message_created_update_chat on public.messages;
create trigger on_message_created_update_chat
after insert on public.messages
for each row
execute function public.handle_new_message_metadata();

create or replace view public.listings_catalog
with (security_invoker = true) as
select
  l.id,
  l.seller_id,
  l.slug,
  l.title,
  l.description,
  l.price,
  l.currency,
  l.condition,
  l.status,
  l.gender,
  l.city,
  l.material,
  l.color,
  l.is_vip,
  l.published_at,
  c.name as category_name,
  c.slug as category_slug,
  b.name as brand_name,
  s.label as size_label,
  p.username as seller_username,
  p.full_name as seller_full_name,
  coalesce(l.cover_image_url, img.image_url) as cover_image_url
from public.listings l
join public.categories c on c.id = l.category_id
left join public.brands b on b.id = l.brand_id
left join public.sizes s on s.id = l.size_id
left join public.profiles p on p.id = l.seller_id
left join lateral (
  select image_url
  from public.listing_images
  where listing_id = l.id
  order by sort_order asc, created_at asc
  limit 1
) img on true;

grant select on public.listings_catalog to anon, authenticated;

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
  greatest(coalesce(c.last_message_at, c.created_at), c.created_at) as sort_at
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
