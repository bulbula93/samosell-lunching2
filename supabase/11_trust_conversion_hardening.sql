create table if not exists public.user_action_rate_limits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  window_started_at timestamp with time zone not null default now(),
  hits integer not null default 0 check (hits >= 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (user_id, action)
);

create index if not exists idx_user_action_rate_limits_updated_at
  on public.user_action_rate_limits (updated_at desc);

drop trigger if exists set_user_action_rate_limits_updated_at on public.user_action_rate_limits;
create trigger set_user_action_rate_limits_updated_at
before update on public.user_action_rate_limits
for each row
execute function public.set_updated_at();

alter table public.user_action_rate_limits enable row level security;

drop policy if exists "users can read own action limits" on public.user_action_rate_limits;
create policy "users can read own action limits"
on public.user_action_rate_limits
for select
to authenticated
using (user_id = auth.uid());

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
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamp with time zone := now();
  v_row public.user_action_rate_limits%rowtype;
  v_reset_at timestamp with time zone;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_window_seconds <= 0 or p_max_hits <= 0 then
    raise exception 'bad_rate_limit_arguments';
  end if;

  select *
  into v_row
  from public.user_action_rate_limits
  where user_id = v_user_id and action = p_action
  for update;

  if not found then
    insert into public.user_action_rate_limits (user_id, action, window_started_at, hits)
    values (v_user_id, p_action, v_now, 1);

    return query select true, 1, p_max_hits, 0;
    return;
  end if;

  v_reset_at := v_row.window_started_at + make_interval(secs => p_window_seconds);

  if v_now >= v_reset_at then
    update public.user_action_rate_limits
    set window_started_at = v_now,
        hits = 1
    where user_id = v_user_id and action = p_action;

    return query select true, 1, p_max_hits, 0;
    return;
  end if;

  if v_row.hits < p_max_hits then
    update public.user_action_rate_limits
    set hits = v_row.hits + 1
    where user_id = v_user_id and action = p_action;

    return query select true, v_row.hits + 1, p_max_hits, greatest(0, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
    return;
  end if;

  return query
  select false, v_row.hits, p_max_hits, greatest(0, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
end;
$$;

grant execute on function public.consume_action_rate_limit(text, integer, integer) to authenticated;

create or replace function public.sync_listing_favorites_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.listings
    set favorites_count = favorites_count + 1
    where id = new.listing_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.listings
    set favorites_count = greatest(favorites_count - 1, 0)
    where id = old.listing_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_favorite_insert_sync_count on public.favorites;
create trigger on_favorite_insert_sync_count
after insert on public.favorites
for each row
execute function public.sync_listing_favorites_count();

drop trigger if exists on_favorite_delete_sync_count on public.favorites;
create trigger on_favorite_delete_sync_count
after delete on public.favorites
for each row
execute function public.sync_listing_favorites_count();

update public.listings l
set favorites_count = coalesce(f.favorites_count, 0)
from (
  select listing_id, count(*)::integer as favorites_count
  from public.favorites
  group by listing_id
) f
where f.listing_id = l.id;

update public.listings
set favorites_count = 0
where id not in (select distinct listing_id from public.favorites)
  and favorites_count <> 0;

create or replace function public.increment_listing_views(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings
  set views_count = views_count + 1
  where id = p_listing_id
    and status = 'active';
end;
$$;

grant execute on function public.increment_listing_views(uuid) to anon, authenticated;

create index if not exists idx_listings_seller_status_created_at
  on public.listings (seller_id, status, created_at desc);

create index if not exists idx_listings_catalog_discovery
  on public.listings (status, category_id, brand_id, size_id, published_at desc);

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
  case when l.is_vip = true and (l.vip_until is null or l.vip_until > now()) then true else false end as is_vip,
  case when l.promoted_until is not null and l.promoted_until > now() then true else false end as is_promoted,
  case when l.featured_until is not null and l.featured_until > now() then true else false end as is_featured,
  l.vip_until,
  l.promoted_until,
  l.featured_until,
  l.featured_slot,
  l.favorites_count,
  l.views_count,
  l.published_at,
  c.name as category_name,
  c.slug as category_slug,
  b.name as brand_name,
  s.label as size_label,
  p.username as seller_username,
  p.full_name as seller_full_name,
  p.created_at as seller_created_at,
  p.is_seller_verified as seller_is_verified,
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
