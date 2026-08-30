create or replace function public.sync_listing_review_request_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_event_key text;
  v_new_event_key text;
  v_should_notify boolean := false;
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
        href = null,
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
    if tg_op = 'INSERT' then
      v_should_notify := true;
    elsif old.status is distinct from new.status
      or old.sold_to_user_id is distinct from new.sold_to_user_id
    then
      v_should_notify := true;
    end if;

    if v_should_notify then
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
