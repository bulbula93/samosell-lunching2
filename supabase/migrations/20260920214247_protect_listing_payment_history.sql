create or replace function private.prevent_listing_delete_with_payment_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.listing_boost_orders o
    where o.listing_id = old.id
  ) then
    raise exception using errcode = 'P0001', message = 'listing_has_payment_history';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_listing_delete_with_payment_history on public.listings;
create trigger prevent_listing_delete_with_payment_history
before delete on public.listings
for each row execute function private.prevent_listing_delete_with_payment_history();

revoke all on function private.prevent_listing_delete_with_payment_history() from public, anon, authenticated;
