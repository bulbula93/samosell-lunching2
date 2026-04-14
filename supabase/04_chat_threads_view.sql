-- Migration 04: chat_threads view + missing policies
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. chat_threads view (fixes the error in the UI)
-- =============================================
create or replace view public.chat_threads
with (security_invoker = true) as
select
  c.id,
  c.created_at,
  c.last_message_at,
  c.listing_id,
  c.buyer_id,
  c.seller_id,
  l.title          as listing_title,
  l.slug           as listing_slug,
  l.cover_image_url as listing_cover,
  l.price          as listing_price,
  l.currency       as listing_currency,
  b.username       as buyer_username,
  b.full_name      as buyer_full_name,
  s.username       as seller_username,
  s.full_name      as seller_full_name,
  last_msg.body    as last_message_body,
  last_msg.sender_id as last_message_sender_id,
  last_msg.created_at as last_message_created_at
from public.chats c
join public.listings l on l.id = c.listing_id
join public.profiles b on b.id = c.buyer_id
join public.profiles s on s.id = c.seller_id
left join lateral (
  select body, sender_id, created_at
  from public.messages
  where chat_id = c.id
  order by created_at desc
  limit 1
) last_msg on true;

grant select on public.chat_threads to authenticated;

-- =============================================
-- 2. Make sure messages can be updated (for read receipts later)
-- =============================================
drop policy if exists "participants can update own messages" on public.messages;
create policy "participants can update own messages"
on public.messages
for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

-- =============================================
-- 3. Allow authenticated users to delete own messages
-- =============================================
drop policy if exists "users can delete own messages" on public.messages;
create policy "users can delete own messages"
on public.messages
for delete
to authenticated
using (sender_id = auth.uid());

-- =============================================
-- 4. Fix: last_message_at update needs to work for participants
-- =============================================
-- (Already handled by "participants can update chats" policy in migration 02)

-- =============================================
-- Done! Verify with:
-- select * from public.chat_threads limit 5;
-- =============================================
