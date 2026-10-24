-- Growth P0: distinguish marketplace sales from sales completed elsewhere.
-- Apply to QA/Preview only after review. No production migration in this PR.
alter table public.listings
  add column if not exists sold_source text;
alter table public.listings
  drop constraint if exists listings_sold_source_check;
alter table public.listings
  add constraint listings_sold_source_check
  check (sold_source is null or sold_source in ('samosell', 'external')) not valid;

-- Legacy sold listings have no asserted attribution.
-- The existing buyer-backed sold flow can still be recognized as SamoSell during reporting.
create or replace function public.enforce_listing_sold_buyer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'sold' then
    new.sold_to_user_id := null;
    new.sold_source := null;
    return new;
  end if;

  -- Backwards compatibility for existing functions that complete a sale with a selected buyer.
  if new.sold_source is null and new.sold_to_user_id is not null then
    new.sold_source := 'samosell';
  end if;

  if new.sold_source = 'external' then
    if new.sold_to_user_id is not null then
      raise exception using errcode = '22023', message = 'external_sale_buyer_not_allowed';
    end if;
    return new;
  end if;

  if new.sold_source is distinct from 'samosell' or new.sold_to_user_id is null then
    raise exception using errcode = '22023', message = 'sold_buyer_required';
  end if;
  if new.sold_to_user_id = new.seller_id then
    raise exception using errcode = '22023', message = 'invalid_sold_buyer';
  end if;
  if not exists (
    select 1 from public.chats chat
    join public.profiles buyer_profile on buyer_profile.id = chat.buyer_id
    where chat.listing_id = new.id
      and chat.seller_id = new.seller_id
      and chat.buyer_id = new.sold_to_user_id
      and not buyer_profile.is_suspended
      and exists (
        select 1 from public.messages message_row
        where message_row.chat_id = chat.id
          and message_row.sender_id = new.sold_to_user_id
      )
  ) then
    raise exception using errcode = '22023', message = 'invalid_sold_buyer';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_listing_sold_buyer() from public, anon, authenticated;
-- Re-fire validation when source changes independently.
drop trigger if exists listings_enforce_sold_buyer on public.listings;
create trigger listings_enforce_sold_buyer
before insert or update of status, sold_to_user_id, sold_source
on public.listings
for each row
execute function public.enforce_listing_sold_buyer();

create index if not exists idx_listings_sold_source
on public.listings (sold_source)
where status = 'sold';
