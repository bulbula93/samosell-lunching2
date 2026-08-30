-- Complete the Sold -> Buyer -> Review lifecycle with database-backed notifications.
-- Reputation remains live through public.seller_review_summaries, which aggregates listing_reviews.

create or replace function public.sync_listing_review_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_event_key text;
  v_new_event_key text;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'sold'
      and old.sold_to_user_id is not null
      and (
        new.status is distinct from old.status
        or new.sold_to_user_id is distinct from old.sold_to_user_id
      )
    then
      v_old_event_key := format('review_request:%s:%s', old.id, old.sold_to_user_id);

      update public.notifications
      set
        type = 'review_request_canceled',
        title = 'შეფასების მოთხოვნა გაუქმდა',
        body = format('„%s“-ზე შეფასების მოთხოვნა აღარ არის აქტიური.', old.title),
        read_at = coalesce(read_at, now()),
        metadata = metadata || jsonb_build_object(
          'status', 'canceled',
          'canceled_at', now()
        )
      where event_key = v_old_event_key
        and type = 'review_request';
    end if;
  end if;

  if new.status = 'sold' and new.sold_to_user_id is not null then
    if tg_op = 'INSERT'
      or old.status is distinct from new.status
      or old.sold_to_user_id is distinct from new.sold_to_user_id
    then
      v_new_event_key := format('review_request:%s:%s', new.id, new.sold_to_user_id);

      insert into public.notifications (
        user_id,
        type,
        title,
        body,
        href,
        actor_id,
        listing_id,
        event_key,
        metadata,
        read_at,
        created_at
      )
      values (
        new.sold_to_user_id,
        'review_request',
        'შეაფასე გამყიდველი',
        format('„%s“ გაყიდულად მოინიშნა და შენ არჩეული მყიდველი ხარ. დატოვე შეფასება გამყიდველზე.', new.title),
        '/listing/' || new.slug,
        new.seller_id,
        new.id,
        v_new_event_key,
        jsonb_build_object(
          'status', 'pending',
          'seller_id', new.seller_id,
          'buyer_id', new.sold_to_user_id
        ),
        null,
        now()
      )
      on conflict (event_key)
      do update set
        user_id = excluded.user_id,
        type = excluded.type,
        title = excluded.title,
        body = excluded.body,
        href = excluded.href,
        actor_id = excluded.actor_id,
        listing_id = excluded.listing_id,
        metadata = excluded.metadata,
        read_at = null,
        created_at = now();
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_listing_review_request_notification()
  from public, anon, authenticated;

drop trigger if exists listings_sync_review_request_notification on public.listings;
create trigger listings_sync_review_request_notification
after insert or update of status, sold_to_user_id
on public.listings
for each row
execute function public.sync_listing_review_request_notification();

create or replace function public.sync_review_completion_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing_title text;
  v_listing_slug text;
  v_request_event_key text;
  v_received_event_key text;
  v_seller_title text;
  v_seller_body text;
begin
  if tg_op = 'UPDATE' then
    if new.score is not distinct from old.score
      and new.comment is not distinct from old.comment
    then
      return new;
    end if;
  end if;

  select listing.title, listing.slug
  into v_listing_title, v_listing_slug
  from public.listings listing
  where listing.id = new.listing_id;

  if v_listing_slug is null then
    return new;
  end if;

  v_request_event_key := format('review_request:%s:%s', new.listing_id, new.reviewer_id);

  update public.notifications
  set
    type = 'review_completed',
    title = 'შეფასება შენახულია',
    body = format('შენი %s-ვარსკვლავიანი შეფასება „%s“-ზე შენახულია.', new.score, v_listing_title),
    href = '/listing/' || v_listing_slug,
    read_at = coalesce(read_at, now()),
    metadata = metadata || jsonb_build_object(
      'status', 'completed',
      'review_id', new.id,
      'score', new.score,
      'completed_at', now()
    )
  where event_key = v_request_event_key;

  if tg_op = 'UPDATE' then
    v_seller_title := 'შეფასება განახლდა';
    v_seller_body := format('მყიდველმა „%s“-ზე შეფასება %s ვარსკვლავზე განაახლა.', v_listing_title, new.score);
  else
    v_seller_title := 'ახალი შეფასება მიიღე';
    v_seller_body := format('მყიდველმა „%s“-ზე %s-ვარსკვლავიანი შეფასება დატოვა.', v_listing_title, new.score);
  end if;

  v_received_event_key := format('review_received:%s', new.id);

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    href,
    actor_id,
    listing_id,
    event_key,
    metadata,
    read_at,
    created_at
  )
  values (
    new.seller_id,
    'review_received',
    v_seller_title,
    v_seller_body,
    '/listing/' || v_listing_slug,
    new.reviewer_id,
    new.listing_id,
    v_received_event_key,
    jsonb_build_object(
      'status', 'received',
      'review_id', new.id,
      'score', new.score,
      'reviewer_id', new.reviewer_id,
      'updated', tg_op = 'UPDATE'
    ),
    null,
    now()
  )
  on conflict (event_key)
  do update set
    user_id = excluded.user_id,
    type = excluded.type,
    title = excluded.title,
    body = excluded.body,
    href = excluded.href,
    actor_id = excluded.actor_id,
    listing_id = excluded.listing_id,
    metadata = excluded.metadata,
    read_at = null,
    created_at = now();

  return new;
end;
$$;

revoke all on function public.sync_review_completion_notifications()
  from public, anon, authenticated;

drop trigger if exists listing_reviews_sync_completion_notifications on public.listing_reviews;
create trigger listing_reviews_sync_completion_notifications
after insert or update of score, comment
on public.listing_reviews
for each row
execute function public.sync_review_completion_notifications();
