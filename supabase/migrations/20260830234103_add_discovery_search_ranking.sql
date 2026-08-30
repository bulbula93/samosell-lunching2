create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.search_catalog_ranked(
  p_query text,
  p_category_slug text default null,
  p_item_keywords text[] default '{}'::text[],
  p_brand text default null,
  p_size text default null,
  p_color text default null,
  p_city text default null,
  p_condition text default null,
  p_gender text default null,
  p_vip boolean default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_offset integer default 0,
  p_limit integer default 24
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with normalized as (
  select
    nullif(btrim(p_query), '') as q,
    nullif(btrim(p_category_slug), '') as category_slug,
    nullif(btrim(p_brand), '') as brand,
    nullif(btrim(p_size), '') as size_label,
    nullif(btrim(p_color), '') as color,
    nullif(btrim(p_city), '') as city,
    nullif(btrim(p_condition), '') as condition,
    nullif(btrim(p_gender), '') as gender
),
ranked as (
  select
    lc.*,
    (
      case when n.q is not null and lower(coalesce(lc.title, '')) = lower(n.q) then 100 else 0 end
      + case when n.q is not null and lower(coalesce(lc.brand_name, '')) = lower(n.q) then 80 else 0 end
      + case when n.q is not null and lower(coalesce(lc.title, '')) like lower(n.q) || '%' then 55 else 0 end
      + case when n.q is not null and lc.title ilike '%' || n.q || '%' then 40 else 0 end
      + case when n.q is not null and lc.brand_name ilike '%' || n.q || '%' then 35 else 0 end
      + case when n.q is not null and lc.category_name ilike '%' || n.q || '%' then 20 else 0 end
      + case when n.q is not null and coalesce(lc.description, '') ilike '%' || n.q || '%' then 8 else 0 end
      + case when n.q is not null and length(n.q) >= 3 then
          greatest(
            extensions.word_similarity(lower(n.q), lower(coalesce(lc.title, ''))) * 35,
            extensions.word_similarity(lower(n.q), lower(coalesce(lc.brand_name, ''))) * 28,
            extensions.word_similarity(lower(n.q), lower(coalesce(lc.category_name, ''))) * 18
          )
        else 0 end
      + case when coalesce(lc.cover_image_url, '') <> '' then 2 else 0 end
      + case when coalesce(lc.seller_is_verified, false) then 2 else 0 end
      + least(5.0, ln(1 + greatest(coalesce(lc.favorites_count, 0), 0)))
      + least(3.0, ln(1 + greatest(coalesce(lc.views_count, 0), 0)) / 2.0)
      + case
          when lc.published_at >= now() - interval '7 days' then 4
          when lc.published_at >= now() - interval '30 days' then 2
          when lc.published_at >= now() - interval '90 days' then 1
          else 0
        end
      + coalesce(lc.promotion_tier, 0) * 1.25
    )::double precision as relevance_score
  from public.listings_catalog lc
  cross join normalized n
  where lc.status = 'active'
    and (
      n.q is null
      or lc.title ilike '%' || n.q || '%'
      or coalesce(lc.description, '') ilike '%' || n.q || '%'
      or coalesce(lc.category_name, '') ilike '%' || n.q || '%'
      or coalesce(lc.brand_name, '') ilike '%' || n.q || '%'
      or (
        length(n.q) >= 3
        and greatest(
          extensions.word_similarity(lower(n.q), lower(coalesce(lc.title, ''))),
          extensions.word_similarity(lower(n.q), lower(coalesce(lc.brand_name, ''))),
          extensions.word_similarity(lower(n.q), lower(coalesce(lc.category_name, '')))
        ) >= 0.42
      )
    )
    and (
      coalesce(cardinality(p_item_keywords), 0) = 0
      or exists (
        select 1
        from unnest(p_item_keywords) as keyword
        where lc.title ilike '%' || keyword || '%'
          or coalesce(lc.description, '') ilike '%' || keyword || '%'
          or coalesce(lc.category_name, '') ilike '%' || keyword || '%'
          or coalesce(lc.brand_name, '') ilike '%' || keyword || '%'
      )
    )
    and (n.category_slug is null or lc.category_slug = n.category_slug)
    and (n.brand is null or lc.brand_name = n.brand)
    and (n.size_label is null or lc.size_label = n.size_label)
    and (n.color is null or lc.color = n.color)
    and (n.city is null or lc.city = n.city)
    and (n.condition is null or lc.condition = n.condition)
    and (n.gender is null or lc.gender = n.gender)
    and (p_vip is null or lc.is_vip = p_vip)
    and (p_min_price is null or lc.price >= p_min_price)
    and (p_max_price is null or lc.price <= p_max_price)
),
paged as (
  select *
  from ranked
  order by
    relevance_score desc,
    promotion_tier desc nulls last,
    published_at desc nulls last,
    id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
)
select jsonb_build_object(
  'items', coalesce(
    (
      select jsonb_agg(
        to_jsonb(p) - 'relevance_score'
        order by p.relevance_score desc, p.promotion_tier desc nulls last, p.published_at desc nulls last, p.id
      )
      from paged p
    ),
    '[]'::jsonb
  ),
  'total_count', (select count(*) from ranked)
);
$$;

revoke all on function public.search_catalog_ranked(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer) from public;
grant execute on function public.search_catalog_ranked(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer) to anon, authenticated;
