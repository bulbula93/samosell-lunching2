begin;

alter table public.listings
  add column if not exists content_updated_at timestamptz;

update public.listings
set content_updated_at = coalesce(updated_at, published_at, created_at, now())
where content_updated_at is null;

alter table public.listings
  alter column content_updated_at set default now(),
  alter column content_updated_at set not null;

create or replace function private.track_listing_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.content_updated_at := now();
    return new;
  end if;

  if
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.price is distinct from old.price
    or new.currency is distinct from old.currency
    or new.condition is distinct from old.condition
    or new.category_id is distinct from old.category_id
    or new.brand_id is distinct from old.brand_id
    or new.size_id is distinct from old.size_id
    or new.city is distinct from old.city
    or new.material is distinct from old.material
    or new.color is distinct from old.color
    or new.gender is distinct from old.gender
    or new.sale_type is distinct from old.sale_type
    or new.cover_image_url is distinct from old.cover_image_url
  then
    new.content_updated_at := now();
  else
    new.content_updated_at := old.content_updated_at;
  end if;

  return new;
end;
$$;

revoke all on function private.track_listing_content_updated_at()
  from public, anon, authenticated;

drop trigger if exists track_listing_content_updated_at on public.listings;
create trigger track_listing_content_updated_at
before insert or update on public.listings
for each row
execute function private.track_listing_content_updated_at();

create index if not exists idx_listings_seller_content_freshness
  on public.listings (seller_id, status, content_updated_at);

commit;
