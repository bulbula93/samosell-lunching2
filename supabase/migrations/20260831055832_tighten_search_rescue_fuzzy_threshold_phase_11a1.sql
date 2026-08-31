create or replace function public.search_catalog_rescue(
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
  p_limit integer default 24,
  p_ranking_version text default null
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
config_doc as (
  select
    coalesce((select h.weights from public.search_ranking_config_history h where h.version = nullif(btrim(p_ranking_version), '') order by h.created_at desc limit 1), (select c.weights from public.search_ranking_config c where c.id = 1)) as weights,
    coalesce((select h.version from public.search_ranking_config_history h where h.version = nullif(btrim(p_ranking_version), '') order by h.created_at desc limit 1), (select c.version from public.search_ranking_config c where c.id = 1), 'phase10-v1') as version
),
config as (
  select
    d.version,
    coalesce((d.weights->>'title_exact')::double precision, 100) as title_exact,
    coalesce((d.weights->>'brand_exact')::double precision, 80) as brand_exact,
    coalesce((d.weights->>'title_prefix')::double precision, 55) as title_prefix,
    coalesce((d.weights->>'title_contains')::double precision, 40) as title_contains,
    coalesce((d.weights->>'brand_contains')::double precision, 35) as brand_contains,
    coalesce((d.weights->>'category_contains')::double precision, 20) as category_contains,
    coalesce((d.weights->>'description_contains')::double precision, 8) as description_contains,
    coalesce((d.weights->>'title_fuzzy')::double precision, 35) as title_fuzzy,
    coalesce((d.weights->>'brand_fuzzy')::double precision, 28) as brand_fuzzy,
    coalesce((d.weights->>'category_fuzzy')::double precision, 18) as category_fuzzy,
    coalesce((d.weights->>'cover_image')::double precision, 2) as cover_image,
    coalesce((d.weights->>'verified_seller')::double precision, 2) as verified_seller,
    coalesce((d.weights->>'favorites_cap')::double precision, 5) as favorites_cap,
    coalesce((d.weights->>'views_cap')::double precision, 3) as views_cap,
    coalesce((d.weights->>'fresh_7d')::double precision, 4) as fresh_7d,
    coalesce((d.weights->>'fresh_30d')::double precision, 2) as fresh_30d,
    coalesce((d.weights->>'fresh_90d')::double precision, 1) as fresh_90d,
    coalesce((d.weights->>'promotion_tier')::double precision, 1.25) as promotion_tier,
    greatest(0.38, coalesce((d.weights->>'fuzzy_threshold')::double precision, 0.42) - 0.04) as rescue_fuzzy_threshold
  from config_doc d
),
expanded as (
  select e.term, e.source, e.priority
  from normalized n
  cross join lateral public.get_search_query_expansions(n.q) e
  where n.q is not null
  union all
  select n.q, 'fuzzy'::text, 90
  from normalized n
  where n.q is not null and length(n.q) >= 3
),
terms as (
  select distinct on (lower(term)) term, source, priority
  from expanded
  where nullif(btrim(term), '') is not null
  order by lower(term), priority
),
matches as (
  select
    lc.*,
    t.term as matched_query,
    t.source as rescue_mode,
    t.priority as rescue_priority,
    (
      case when lower(coalesce(lc.title, '')) = lower(t.term) then c.title_exact else 0 end
      + case when lower(coalesce(lc.brand_name, '')) = lower(t.term) then c.brand_exact else 0 end
      + case when lower(coalesce(lc.title, '')) like lower(t.term) || '%' then c.title_prefix else 0 end
      + case when lc.title ilike '%' || t.term || '%' then c.title_contains else 0 end
      + case when lc.brand_name ilike '%' || t.term || '%' then c.brand_contains else 0 end
      + case when lc.category_name ilike '%' || t.term || '%' then c.category_contains else 0 end
      + case when coalesce(lc.description, '') ilike '%' || t.term || '%' then c.description_contains else 0 end
      + case when length(t.term) >= 3 then greatest(
          extensions.word_similarity(lower(t.term), lower(coalesce(lc.title, ''))) * c.title_fuzzy,
          extensions.word_similarity(lower(t.term), lower(coalesce(lc.brand_name, ''))) * c.brand_fuzzy,
          extensions.word_similarity(lower(t.term), lower(coalesce(lc.category_name, ''))) * c.category_fuzzy
        ) else 0 end
      + case when coalesce(lc.cover_image_url, '') <> '' then c.cover_image else 0 end
      + case when coalesce(lc.seller_is_verified, false) then c.verified_seller else 0 end
      + least(c.favorites_cap, ln(1 + greatest(coalesce(lc.favorites_count, 0), 0)))
      + least(c.views_cap, ln(1 + greatest(coalesce(lc.views_count, 0), 0)) / 2.0)
      + case when lc.published_at >= now() - interval '7 days' then c.fresh_7d when lc.published_at >= now() - interval '30 days' then c.fresh_30d when lc.published_at >= now() - interval '90 days' then c.fresh_90d else 0 end
      + coalesce(lc.promotion_tier, 0) * c.promotion_tier
      + case when t.source = 'alias' then 8 when t.source = 'transliteration' then 6 else 0 end
    )::double precision as relevance_score
  from public.listings_catalog lc
  cross join normalized n
  cross join config c
  cross join terms t
  where lc.status = 'active'
    and (
      lc.title ilike '%' || t.term || '%'
      or coalesce(lc.description, '') ilike '%' || t.term || '%'
      or coalesce(lc.category_name, '') ilike '%' || t.term || '%'
      or coalesce(lc.brand_name, '') ilike '%' || t.term || '%'
      or (length(t.term) >= 3 and greatest(
          extensions.word_similarity(lower(t.term), lower(coalesce(lc.title, ''))),
          extensions.word_similarity(lower(t.term), lower(coalesce(lc.brand_name, ''))),
          extensions.word_similarity(lower(t.term), lower(coalesce(lc.category_name, '')))
        ) >= c.rescue_fuzzy_threshold)
    )
    and (coalesce(cardinality(p_item_keywords), 0) = 0 or exists (
      select 1 from unnest(p_item_keywords) as keyword
      where lc.title ilike '%' || keyword || '%'
        or coalesce(lc.description, '') ilike '%' || keyword || '%'
        or coalesce(lc.category_name, '') ilike '%' || keyword || '%'
        or coalesce(lc.brand_name, '') ilike '%' || keyword || '%'
    ))
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
dedup as (
  select distinct on (id) *
  from matches
  order by id, relevance_score desc, rescue_priority, matched_query
),
ordered as (
  select *
  from dedup
  order by relevance_score desc, promotion_tier desc nulls last, published_at desc nulls last, id
),
paged as (
  select * from ordered
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
),
best as (
  select matched_query, rescue_mode
  from ordered
  limit 1
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(to_jsonb(p) - 'relevance_score' - 'matched_query' - 'rescue_mode' - 'rescue_priority' order by p.relevance_score desc, p.promotion_tier desc nulls last, p.published_at desc nulls last, p.id) from paged p), '[]'::jsonb),
  'total_count', (select count(*) from dedup),
  'ranking_version', (select version from config),
  'rescue_mode', coalesce((select rescue_mode from best), 'none'),
  'resolved_query', (select matched_query from best)
);
$$;

revoke all on function public.search_catalog_rescue(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer, text) from public;
grant execute on function public.search_catalog_rescue(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer, text) to anon, authenticated;
