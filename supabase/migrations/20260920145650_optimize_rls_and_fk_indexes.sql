-- Performance cleanup: RLS initplans, duplicate permissive policies, and missing FK indexes.

create index if not exists notifications_actor_id_idx
  on public.notifications (actor_id);
create index if not exists notifications_listing_id_idx
  on public.notifications (listing_id);
create index if not exists push_deliveries_subscription_id_idx
  on public.push_deliveries (subscription_id);
create index if not exists saved_search_listing_matches_listing_id_idx
  on public.saved_search_listing_matches (listing_id);
create index if not exists search_interactions_user_id_idx
  on public.search_interactions (user_id);
create index if not exists search_query_aliases_created_by_idx
  on public.search_query_aliases (created_by);
create index if not exists search_ranking_config_updated_by_idx
  on public.search_ranking_config (updated_by);
create index if not exists search_ranking_config_history_changed_by_idx
  on public.search_ranking_config_history (changed_by);
create index if not exists search_ranking_experiments_created_by_idx
  on public.search_ranking_experiments (created_by);
create index if not exists story_listing_clicks_user_id_idx
  on public.story_listing_clicks (user_id);
create index if not exists story_mutes_muted_user_id_idx
  on public.story_mutes (muted_user_id);
create index if not exists story_reports_reporter_id_idx
  on public.story_reports (reporter_id);

drop policy if exists "Public read profiles" on public.profiles;

alter policy "users can insert own profile" on public.profiles
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "admins can update profiles" on public.profiles;
create policy "users and admins can update profiles"
  on public.profiles
  for update
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  )
  with check (
    id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

alter policy "public can read active listings" on public.listings
  to anon
  using (status = 'active'::text);

drop policy if exists "users can read own listings" on public.listings;
drop policy if exists "admins can read all listings" on public.listings;
drop policy if exists "chat participants can read linked listings" on public.listings;
create policy "authenticated can read accessible listings"
  on public.listings
  for select
  to authenticated
  using (
    status = 'active'::text
    or seller_id = (select auth.uid())
    or exists (
      select 1 from public.chats c
      where c.listing_id = listings.id
        and (
          c.buyer_id = (select auth.uid())
          or c.seller_id = (select auth.uid())
        )
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

alter policy "users can insert own listings" on public.listings
  to authenticated
  with check (seller_id = (select auth.uid()));

alter policy "users can delete own listings" on public.listings
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists "users can update own listings" on public.listings;
drop policy if exists "admins can update any listing" on public.listings;
create policy "users and admins can update listings"
  on public.listings
  for update
  to authenticated
  using (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  )
  with check (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

alter policy "public can read images of active listings" on public.listing_images
  to anon
  using (
    exists (
      select 1 from public.listings
      where listings.id = listing_images.listing_id
        and listings.status = 'active'::text
    )
  );

drop policy if exists "users can read own listing images" on public.listing_images;
create policy "authenticated can read accessible listing images"
  on public.listing_images
  for select
  to authenticated
  using (
    exists (
      select 1 from public.listings
      where listings.id = listing_images.listing_id
        and (
          listings.status = 'active'::text
          or listings.seller_id = (select auth.uid())
        )
    )
  );

alter policy "users can insert own listing images" on public.listing_images
  to authenticated
  with check (
    exists (
      select 1 from public.listings
      where listings.id = listing_images.listing_id
        and listings.seller_id = (select auth.uid())
    )
  );

alter policy "users can update own listing images" on public.listing_images
  to authenticated
  using (
    exists (
      select 1 from public.listings
      where listings.id = listing_images.listing_id
        and listings.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.listings
      where listings.id = listing_images.listing_id
        and listings.seller_id = (select auth.uid())
    )
  );

alter policy "users can delete own listing images" on public.listing_images
  to authenticated
  using (
    exists (
      select 1 from public.listings
      where listings.id = listing_images.listing_id
        and listings.seller_id = (select auth.uid())
    )
  );

alter policy "users can manage own favorites" on public.favorites
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "participants can read chats" on public.chats
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
  );

alter policy "participants can update chats" on public.chats
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
  )
  with check (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
  );

alter policy "participants can read messages" on public.messages
  to authenticated
  using (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
        and (
          chats.buyer_id = (select auth.uid())
          or chats.seller_id = (select auth.uid())
        )
    )
  );

alter policy "chat_offers_select_participants" on public.chat_offers
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
  );

alter policy "users can read own action limits" on public.user_action_rate_limits
  to authenticated
  using (user_id = (select auth.uid()));

alter policy "notifications_select_own" on public.notifications
  to authenticated
  using (user_id = (select auth.uid()));

alter policy "saved_searches_select_own" on public.saved_searches
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "admins can read all boost payment events" on public.listing_boost_order_events;
drop policy if exists "sellers can read own boost payment events" on public.listing_boost_order_events;
create policy "sellers and admins can read boost payment events"
  on public.listing_boost_order_events
  for select
  to authenticated
  using (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

drop policy if exists "admins can read all boost orders" on public.listing_boost_orders;
drop policy if exists "sellers can read own boost orders" on public.listing_boost_orders;
create policy "sellers and admins can read boost orders"
  on public.listing_boost_orders
  for select
  to authenticated
  using (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

alter policy "admins can update boost orders" on public.listing_boost_orders
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

alter policy "public can read active boost products" on public.listing_boost_products
  to anon
  using (is_active = true);

drop policy if exists "admins can manage boost products" on public.listing_boost_products;
drop policy if exists "sellers can read products from own boost orders" on public.listing_boost_products;

create policy "authenticated can read accessible boost products"
  on public.listing_boost_products
  for select
  to authenticated
  using (
    is_active = true
    or exists (
      select 1 from public.listing_boost_orders o
      where o.product_id = listing_boost_products.id
        and o.seller_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

create policy "admins can insert boost products"
  on public.listing_boost_products
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

create policy "admins can update boost products"
  on public.listing_boost_products
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

create policy "admins can delete boost products"
  on public.listing_boost_products
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

drop policy if exists "admins can read all boost refunds" on public.listing_boost_refund_requests;
drop policy if exists "sellers can read own boost refunds" on public.listing_boost_refund_requests;
create policy "sellers and admins can read boost refunds"
  on public.listing_boost_refund_requests
  for select
  to authenticated
  using (
    seller_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

drop policy if exists "admins can read all stories" on public.stories;
drop policy if exists "authenticated can read active stories" on public.stories;
drop policy if exists "owners can read own stories" on public.stories;
create policy "authenticated can read accessible stories"
  on public.stories
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_current_user_admin())
    or (
      deleted_at is null
      and expires_at > now()
      and exists (
        select 1 from public.profiles p
        where p.id = stories.user_id
          and not p.is_suspended
      )
      and not exists (
        select 1 from public.user_blocks b
        where (
          (b.blocker_id = (select auth.uid()) and b.blocked_id = stories.user_id)
          or
          (b.blocker_id = stories.user_id and b.blocked_id = (select auth.uid()))
        )
      )
      and not exists (
        select 1 from public.story_mutes sm
        where sm.user_id = (select auth.uid())
          and sm.muted_user_id = stories.user_id
      )
    )
  );
