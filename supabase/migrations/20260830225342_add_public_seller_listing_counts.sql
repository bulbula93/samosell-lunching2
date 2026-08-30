create or replace function public.get_public_seller_listing_counts(p_seller_id uuid)
returns table(active_count bigint, sold_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where l.status = 'active')::bigint as active_count,
    count(*) filter (where l.status = 'sold')::bigint as sold_count
  from public.listings l
  where l.seller_id = p_seller_id
    and exists (
      select 1
      from public.profiles p
      where p.id = p_seller_id
        and coalesce(p.is_suspended, false) = false
    );
$$;

revoke all on function public.get_public_seller_listing_counts(uuid) from public;
grant execute on function public.get_public_seller_listing_counts(uuid) to anon, authenticated;
