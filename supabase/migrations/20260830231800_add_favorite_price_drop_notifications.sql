create or replace function public.notify_favorite_price_drop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or new.price >= old.price then
    return new;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    href,
    actor_id,
    listing_id,
    event_key,
    metadata
  )
  select
    favorite.user_id,
    'price_drop',
    'ფასი შემცირდა',
    format(
      '„%s“-ის ფასი შემცირდა: %s %s → %s %s.',
      new.title,
      old.price,
      new.currency,
      new.price,
      new.currency
    ),
    '/listing/' || new.slug,
    new.seller_id,
    new.id,
    format(
      'price_drop:%s:%s:%s:%s:%s',
      new.id,
      favorite.user_id,
      new.updated_at,
      old.price,
      new.price
    ),
    jsonb_build_object(
      'old_price', old.price,
      'new_price', new.price,
      'currency', new.currency,
      'seller_id', new.seller_id,
      'status', 'price_dropped'
    )
  from public.favorites favorite
  join public.profiles favorite_owner
    on favorite_owner.id = favorite.user_id
  where favorite.listing_id = new.id
    and favorite.user_id <> new.seller_id
    and not favorite_owner.is_suspended
    and not exists (
      select 1
      from public.user_blocks block_row
      where (
        block_row.blocker_id = favorite.user_id
        and block_row.blocked_id = new.seller_id
      ) or (
        block_row.blocker_id = new.seller_id
        and block_row.blocked_id = favorite.user_id
      )
    )
  on conflict (event_key) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_favorite_price_drop()
  from public, anon, authenticated;

drop trigger if exists listings_notify_favorite_price_drop on public.listings;
create trigger listings_notify_favorite_price_drop
after update of price
on public.listings
for each row
when (new.price < old.price)
execute function public.notify_favorite_price_drop();
