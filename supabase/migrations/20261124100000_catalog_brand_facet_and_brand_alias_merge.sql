-- 1) Catalog brand facet: brands that currently have active listings, most-used first.
-- 2) Merge brand rows that are only Georgian spellings of an existing brand
--    (ზარა / ზარა. -> Zara, ნაიკი -> Nike, ...) so search and the brand filter
--    treat them as one brand. Duplicates are deactivated, never deleted.

insert into public.search_query_aliases (canonical_term, alias, kind)
values ('Bershka', 'ბერშკა', 'brand')
on conflict (alias_normalized) do nothing;

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
    ),
    'brands',
    coalesce(
      (
        select jsonb_agg(x.brand order by x.listings desc, lower(x.brand))
        from (
          -- Exact brand_name values: the catalog brand filter matches brand_name exactly.
          select lc.brand_name as brand, count(*) as listings
          from public.listings_catalog lc
          where lc.status = 'active'
            and nullif(btrim(lc.brand_name), '') is not null
          group by lc.brand_name
          order by count(*) desc, lower(lc.brand_name)
          limit 80
        ) x
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_catalog_public_facets() from public;
grant execute on function public.get_catalog_public_facets() to anon, authenticated;

-- Brand merge. A data fix only: the side-effect triggers (updated_at,
-- content_updated_at, saved-search alerts) are paused inside this transaction
-- so sellers' listings are not "bumped" and no alerts go out for unchanged items.
create temporary table brand_merge on commit drop as
select dup.id as duplicate_id, canonical.id as canonical_id
from public.brands dup
join public.search_query_aliases a
  on a.is_active
 and a.kind = 'brand'
 and lower(a.alias) = lower(regexp_replace(btrim(dup.name), '[.\s]+$', ''))
join public.brands canonical
  on lower(btrim(canonical.name)) = lower(btrim(a.canonical_term))
 and canonical.is_active
where canonical.id <> dup.id;

alter table public.listings disable trigger set_listings_updated_at;
alter table public.listings disable trigger track_listing_content_updated_at;
alter table public.listings disable trigger listings_saved_search_alerts;

update public.listings l
set brand_id = m.canonical_id
from brand_merge m
where l.brand_id = m.duplicate_id;

update public.brands b
set is_active = false
from brand_merge m
where b.id = m.duplicate_id;

alter table public.listings enable trigger set_listings_updated_at;
alter table public.listings enable trigger track_listing_content_updated_at;
alter table public.listings enable trigger listings_saved_search_alerts;
