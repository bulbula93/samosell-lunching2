-- Search: when the whole query is a brand (in any spelling), match every spelling.
-- "ზარა" and "zara"/"Zara" now return the same listings: brand_name = Zara and
-- titles/descriptions written either way ("ზარას შავი ჯინსი", "Zara jeans").
-- Spellings come from public.search_query_aliases (kind = 'brand').
-- Only the primary search changes; ranking weights, filters and rescue are untouched.

create or replace function public.search_catalog_ranked_primary(p_query text, p_category_slug text DEFAULT NULL::text, p_item_keywords text[] DEFAULT '{}'::text[], p_brand text DEFAULT NULL::text, p_size text DEFAULT NULL::text, p_color text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_condition text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_vip boolean DEFAULT NULL::boolean, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24, p_ranking_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
brand_group as (
  -- Canonical brand when the whole query is a brand name or one of its spellings.
  select a.canonical_normalized as canonical
  from public.search_query_aliases a
  cross join normalized n
  where n.q is not null
    and a.is_active
    and a.kind = 'brand'
    and lower(regexp_replace(n.q, '\s+', ' ', 'g')) in (a.alias_normalized, a.canonical_normalized)
  limit 1
),
brand_terms as (
  -- Every spelling of that brand (lower-case), e.g. {zara, ზარა}.
  select distinct t.term
  from brand_group g
  cross join lateral (
    select g.canonical as term
    union all
    select a.alias_normalized
    from public.search_query_aliases a
    where a.is_active and a.kind = 'brand' and a.canonical_normalized = g.canonical
  ) t
  where length(t.term) >= 2
),
config_doc as (
  select
    coalesce(
      (select h.weights from public.search_ranking_config_history h where h.version = nullif(btrim(p_ranking_version), '') order by h.created_at desc limit 1),
      (select c.weights from public.search_ranking_config c where c.id = 1)
    ) as weights,
    coalesce(
      (select h.version from public.search_ranking_config_history h where h.version = nullif(btrim(p_ranking_version), '') order by h.created_at desc limit 1),
      (select c.version from public.search_ranking_config c where c.id = 1),
      'phase10-v1'
    ) as version
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
    coalesce((d.weights->>'fuzzy_threshold')::double precision, 0.42) as fuzzy_threshold
  from config_doc d
),
ranked as (
  select
    lc.*,
    (
      case when n.q is not null and lower(coalesce(lc.title, '')) = lower(n.q) then c.title_exact else 0 end
      + case when n.q is not null and lower(coalesce(lc.brand_name, '')) = lower(n.q) then c.brand_exact else 0 end
      + case when n.q is not null and lower(coalesce(lc.title, '')) like lower(n.q) || '%' then c.title_prefix else 0 end
      + case when n.q is not null and lc.title ilike '%' || n.q || '%' then c.title_contains else 0 end
      + case when n.q is not null and lc.brand_name ilike '%' || n.q || '%' then c.brand_contains else 0 end
      + case when n.q is not null and lc.category_name ilike '%' || n.q || '%' then c.category_contains else 0 end
      + case when n.q is not null and coalesce(lc.description, '') ilike '%' || n.q || '%' then c.description_contains else 0 end
      + case when n.q is not null and length(n.q) >= 3 then
          greatest(
            extensions.word_similarity(lower(n.q), lower(coalesce(lc.title, ''))) * c.title_fuzzy,
            extensions.word_similarity(lower(n.q), lower(coalesce(lc.brand_name, ''))) * c.brand_fuzzy,
            extensions.word_similarity(lower(n.q), lower(coalesce(lc.category_name, ''))) * c.category_fuzzy
          )
        else 0 end
      -- Brand in another spelling: same weight as a direct brand / title hit.
      + case when lower(coalesce(lc.brand_name, '')) <> lower(coalesce(n.q, ''))
          and exists (select 1 from brand_terms b where lower(btrim(coalesce(lc.brand_name, ''))) = b.term)
          then c.brand_exact else 0 end
      + case when coalesce(lc.title, '') not ilike '%' || coalesce(n.q, '') || '%'
          and exists (select 1 from brand_terms b where position(b.term in lower(coalesce(lc.title, ''))) > 0)
          then c.title_contains else 0 end
      + case when coalesce(lc.cover_image_url, '') <> '' then c.cover_image else 0 end
      + case when coalesce(lc.seller_is_verified, false) then c.verified_seller else 0 end
      + least(c.favorites_cap, ln(1 + greatest(coalesce(lc.favorites_count, 0), 0)))
      + least(c.views_cap, ln(1 + greatest(coalesce(lc.views_count, 0), 0)) / 2.0)
      + case
          when lc.published_at >= now() - interval '7 days' then c.fresh_7d
          when lc.published_at >= now() - interval '30 days' then c.fresh_30d
          when lc.published_at >= now() - interval '90 days' then c.fresh_90d
          else 0
        end
      + coalesce(lc.promotion_tier, 0) * c.promotion_tier
    )::double precision as relevance_score
  from public.listings_catalog lc
  cross join normalized n
  cross join config c
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
        ) >= c.fuzzy_threshold
      )
      or exists (
        select 1
        from brand_terms b
        where lower(btrim(coalesce(lc.brand_name, ''))) = b.term
          or position(b.term in lower(coalesce(lc.title, ''))) > 0
          or position(b.term in lower(coalesce(lc.description, ''))) > 0
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
  order by relevance_score desc, promotion_tier desc nulls last, published_at desc nulls last, id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(to_jsonb(p) - 'relevance_score' order by p.relevance_score desc, p.promotion_tier desc nulls last, p.published_at desc nulls last, p.id) from paged p), '[]'::jsonb),
  'total_count', (select count(*) from ranked),
  'ranking_version', (select version from config),
  'rescue_mode', 'none',
  'resolved_query', null
);
$function$;
