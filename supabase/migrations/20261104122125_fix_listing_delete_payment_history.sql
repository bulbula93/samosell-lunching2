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
      and o.paid_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'listing_has_payment_history';
  end if;
  return old;
end;
$$;

revoke all on function private.prevent_listing_delete_with_payment_history() from public, anon, authenticated;
