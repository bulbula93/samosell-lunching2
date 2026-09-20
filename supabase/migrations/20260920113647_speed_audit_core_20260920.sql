alter function public.search_catalog_ranked(
  text, text, text[], text, text, text, text, text, text,
  boolean, numeric, numeric, integer, integer, text
) security definer;

alter function public.search_catalog_rescue(
  text, text, text[], text, text, text, text, text, text,
  boolean, numeric, numeric, integer, integer, text
) security definer;

create index if not exists favorites_listing_id_idx
  on public.favorites (listing_id);
create index if not exists listing_images_listing_id_idx
  on public.listing_images (listing_id);
create index if not exists listings_brand_id_idx
  on public.listings (brand_id);
create index if not exists listings_category_id_idx
  on public.listings (category_id);
create index if not exists listings_size_id_idx
  on public.listings (size_id);

create or replace function public.get_home_popular_brands(p_limit integer default 8)
returns table(name text, count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select btrim(lc.brand_name) as name, count(*)::bigint as count
  from public.listings_catalog lc
  where lc.status = 'active'
    and nullif(btrim(lc.brand_name), '') is not null
  group by btrim(lc.brand_name)
  order by count(*) desc, btrim(lc.brand_name)
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.get_home_popular_brands(integer) from public;
grant execute on function public.get_home_popular_brands(integer) to anon, authenticated;

create or replace function public.get_catalog_public_facets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'colors',
    coalesce(
      (
        select jsonb_agg(x.color order by x.color)
        from (
          select distinct btrim(lc.color) as color
          from public.listings_catalog lc
          where lc.status = 'active'
            and nullif(btrim(lc.color), '') is not null
        ) x
      ),
      '[]'::jsonb
    ),
    'cities',
    coalesce(
      (
        select jsonb_agg(x.city order by x.city)
        from (
          select distinct btrim(lc.city) as city
          from public.listings_catalog lc
          where lc.status = 'active'
            and nullif(btrim(lc.city), '') is not null
        ) x
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_catalog_public_facets() from public;
grant execute on function public.get_catalog_public_facets() to anon, authenticated;
