-- Restrict review writes to a session-scoped RPC and expose safe aggregates.
alter table public.listing_reviews
  drop constraint if exists listing_reviews_comment_length_check;

alter table public.listing_reviews
  add constraint listing_reviews_comment_length_check
  check (comment is null or char_length(comment) <= 1000) not valid;

alter table public.listing_reviews
  validate constraint listing_reviews_comment_length_check;

alter table public.listing_reviews enable row level security;

drop policy if exists "listing reviews are viewable by everyone"
  on public.listing_reviews;
drop policy if exists "users can delete own listing reviews"
  on public.listing_reviews;
drop policy if exists "users can insert own listing reviews"
  on public.listing_reviews;
drop policy if exists "users can update own listing reviews"
  on public.listing_reviews;

create policy "public can read listing reviews"
on public.listing_reviews
for select
to anon, authenticated
using (true);

revoke all on table public.listing_reviews from public, anon, authenticated;
grant select on table public.listing_reviews to anon, authenticated;

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

  if not exists (
    select 1
    from public.chats chat
    where chat.listing_id = p_listing_id
      and chat.buyer_id = v_reviewer_id
      and chat.seller_id = v_seller_id
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

drop view if exists public.seller_review_summaries;
create view public.seller_review_summaries
with (security_invoker = true)
as
select
  seller_id,
  count(*)::integer as review_count,
  round(avg(score)::numeric, 2) as average_score
from public.listing_reviews
group by seller_id;

revoke all on table public.seller_review_summaries
  from public, anon, authenticated;
grant select on table public.seller_review_summaries to anon, authenticated;
