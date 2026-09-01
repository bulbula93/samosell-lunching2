-- RLS limits listing writes to the owner, but direct Data API calls must not
-- bypass derived counters, publication timestamps, or supported status flows.
create or replace function private.protect_listing_owner_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'active') then
      raise exception 'Invalid initial listing status.' using errcode = '22023';
    end if;

    new.views_count := 0;
    new.favorites_count := 0;
    new.created_at := now();
    new.published_at := case when new.status = 'active' then now() else null end;
    return new;
  end if;

  new.views_count := old.views_count;
  new.favorites_count := old.favorites_count;
  new.created_at := old.created_at;

  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status in ('active', 'archived'))
    or (old.status = 'active' and new.status in ('draft', 'reserved', 'sold', 'archived'))
    or (old.status = 'reserved' and new.status in ('active', 'sold', 'archived'))
    or (old.status = 'sold' and new.status in ('active', 'archived'))
    or (old.status = 'archived' and new.status = 'draft')
  ) then
    raise exception 'Invalid listing status transition.' using errcode = '22023';
  end if;

  if new.status = 'draft' then
    new.published_at := null;
  elsif new.status = 'active' then
    new.published_at := coalesce(old.published_at, now());
  else
    new.published_at := old.published_at;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_listing_owner_integrity()
  from public, anon, authenticated;

drop trigger if exists protect_listing_owner_integrity on public.listings;
create trigger protect_listing_owner_integrity
before insert or update on public.listings
for each row
execute function private.protect_listing_owner_integrity();

alter table public.listings
  add constraint listings_title_length_guard
    check (char_length(btrim(title)) between 3 and 120) not valid,
  add constraint listings_description_length_guard
    check (char_length(btrim(description)) between 10 and 3000) not valid,
  add constraint listings_price_business_guard
    check (price between 0.01 and 99999999.99 and price = round(price, 2)) not valid,
  add constraint listings_currency_gel_guard
    check (currency = 'GEL') not valid,
  add constraint listings_color_length_guard
    check (color is null or char_length(btrim(color)) <= 60) not valid,
  add constraint listings_material_length_guard
    check (material is null or char_length(btrim(material)) <= 100) not valid,
  add constraint listings_city_length_guard
    check (city is null or char_length(btrim(city)) <= 80) not valid,
  add constraint listings_nonnegative_counters_guard
    check (views_count >= 0 and favorites_count >= 0) not valid;

-- Production audit found no violations for these constraints. The description
-- constraint intentionally remains NOT VALID because one legacy row is shorter
-- than the current form minimum and this migration must not rewrite user data.
alter table public.listings validate constraint listings_title_length_guard;
alter table public.listings validate constraint listings_price_business_guard;
alter table public.listings validate constraint listings_currency_gel_guard;
alter table public.listings validate constraint listings_color_length_guard;
alter table public.listings validate constraint listings_material_length_guard;
alter table public.listings validate constraint listings_city_length_guard;
alter table public.listings validate constraint listings_nonnegative_counters_guard;
