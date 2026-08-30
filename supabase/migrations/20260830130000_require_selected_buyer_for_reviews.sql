-- Tie seller reviews to the buyer explicitly selected when a listing is marked sold.
-- The selected buyer must have an actual buyer-authored message in a chat for the listing.

alter table public.listings
  add column if not exists sold_to_user_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_listings_sold_to_user_id
  on public.listings (sold_to_user_id)
  where sold_to_user_id is not null;

alter table public.listings
  drop constraint if exists listings_sold_buyer_not_seller_check;
alter table public.listings
  add constraint listings_sold_buyer_not_seller_check
  check (sold_to_user_id is null or sold_to_user_id <> seller_id) not valid;
alter table public.listings
  validate constraint listings_sold_buyer_not_seller_check;

create or replace function public.enforce_listing_sold_buyer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'sold' then
    new.sold_to_user_id := null;
    return new;
  end if;

  if new.sold_to_user_id is null then
    raise exception using errcode = '22023', message = 'sold_buyer_required';
  end if;

  if new.sold_to_user_id = new.seller_id then
    raise exception using errcode = '22023', message = 'invalid_sold_buyer';
  end if;

  if not exists (
    select 1
    from public.chats chat
    join public.profiles buyer_profile on buyer_profile.id = chat.buyer_id
    where chat.listing_id = new.id
      and chat.seller_id = new.seller_id
      and chat.buyer_id = new.sold_to_user_id
      and not buyer_profile.is_suspended
      and exists (
        select 1
        from public.messages message_row
        where message_row.chat_id = chat.id
          and message_row.sender_id = new.sold_to_user_id
      )
  ) then
    raise exception using errcode = '22023', message = 'invalid_sold_buyer';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_listing_sold_buyer() from public, anon, authenticated;

drop trigger if exists listings_enforce_sold_buyer on public.listings;
create trigger listings_enforce_sold_buyer
before insert or update of status, sold_to_user_id
on public.listings
for each row
execute function public.enforce_listing_sold_buyer();

create or replace function public.is_selected_listing_buyer(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.listings listing
      where listing.id = p_listing_id
        and listing.status = 'sold'
        and listing.sold_to_user_id = auth.uid()
    );
$$;

revoke all on function public.is_selected_listing_buyer(uuid)
  from public, anon, authenticated;
grant execute on function public.is_selected_listing_buyer(uuid)
  to authenticated;

create or replace function public.upsert_listing_review(
  p_listing_id uuid,
  p_score integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_seller_id uuid;
  v_review_id uuid;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_reviewer_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception using errcode = 'P0001', message = 'invalid_review_score';
  end if;

  if v_comment is not null and char_length(v_comment) > 1000 then
    raise exception using errcode = 'P0001', message = 'review_comment_too_long';
  end if;

  select listing.seller_id
  into v_seller_id
  from public.listings listing
  join public.profiles seller_profile on seller_profile.id = listing.seller_id
  where listing.id = p_listing_id
    and listing.status = 'sold'
    and listing.sold_to_user_id = v_reviewer_id
    and not seller_profile.is_suspended
  for update of listing;

  if v_seller_id is null or v_seller_id = v_reviewer_id then
    raise exception using errcode = 'P0001', message = 'review_not_allowed';
  end if;

  if not exists (
    select 1
    from public.profiles reviewer_profile
    where reviewer_profile.id = v_reviewer_id
      and not reviewer_profile.is_suspended
  ) then
    raise exception using errcode = 'P0001', message = 'review_not_allowed';
  end if;

  if exists (
    select 1
    from public.user_blocks block_row
    where (
      block_row.blocker_id = v_reviewer_id
      and block_row.blocked_id = v_seller_id
    ) or (
      block_row.blocker_id = v_seller_id
      and block_row.blocked_id = v_reviewer_id
    )
  ) then
    raise exception using errcode = 'P0001', message = 'review_not_allowed';
  end if;

  insert into public.listing_reviews (
    listing_id,
    seller_id,
    reviewer_id,
    score,
    comment
  )
  values (
    p_listing_id,
    v_seller_id,
    v_reviewer_id,
    p_score,
    v_comment
  )
  on conflict (listing_id, reviewer_id)
  do update set
    seller_id = excluded.seller_id,
    score = excluded.score,
    comment = excluded.comment,
    updated_at = now()
  returning id into v_review_id;

  return v_review_id;
end;
$$;

revoke all on function public.upsert_listing_review(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.upsert_listing_review(uuid, integer, text)
  to authenticated;
