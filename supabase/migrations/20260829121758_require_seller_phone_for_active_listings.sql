update public.profiles
set store_phone = null
where store_phone is not null
  and btrim(store_phone) = '';

alter table public.profiles
  drop constraint if exists profiles_store_phone_format_check;

alter table public.profiles
  add constraint profiles_store_phone_format_check
  check (
    store_phone is null
    or (
      char_length(store_phone) between 7 and 32
      and store_phone ~ '^\+?[0-9 ()-]+$'
      and char_length(regexp_replace(store_phone, '[^0-9]', '', 'g')) between 7 and 15
    )
  );

create or replace function public.enforce_active_listing_seller_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active'
    and not exists (
      select 1
      from public.profiles p
      where p.id = new.seller_id
        and p.store_phone is not null
        and char_length(regexp_replace(p.store_phone, '[^0-9]', '', 'g')) between 7 and 15
    )
  then
    raise exception using
      errcode = '23514',
      message = 'seller_phone_required';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_active_listing_seller_phone() from public, anon, authenticated;

drop trigger if exists enforce_active_listing_seller_phone on public.listings;
create trigger enforce_active_listing_seller_phone
before insert or update of seller_id, status on public.listings
for each row
execute function public.enforce_active_listing_seller_phone();

create or replace function public.protect_active_listing_seller_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.store_phone is null
    or char_length(regexp_replace(new.store_phone, '[^0-9]', '', 'g')) not between 7 and 15
  )
  and exists (
    select 1
    from public.listings l
    where l.seller_id = new.id
      and l.status = 'active'
  )
  then
    raise exception using
      errcode = '23514',
      message = 'seller_phone_required_for_active_listings';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_active_listing_seller_phone() from public, anon, authenticated;

drop trigger if exists protect_active_listing_seller_phone on public.profiles;
create trigger protect_active_listing_seller_phone
before update of store_phone on public.profiles
for each row
execute function public.protect_active_listing_seller_phone();
