insert into public.search_query_aliases (canonical_term, alias, kind)
values
  ('ჩანთა', 'chanta', 'transliteration'),
  ('ბეჭედი', 'bechedi', 'transliteration'),
  ('სათვალე', 'satvale', 'transliteration'),
  ('პიჟამო', 'pijama', 'transliteration'),
  ('პიჟამო', 'პიჟამა', 'synonym')
on conflict (alias_normalized) do nothing;

create or replace function public.search_normalize_query_tokens(p_query text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := lower(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')));
  v_tokens text[];
  v_token text;
  v_resolved text;
  v_output text[] := '{}'::text[];
begin
  if v_query = '' or char_length(v_query) > 200 then
    return null;
  end if;

  v_tokens := regexp_split_to_array(v_query, '\s+');
  if coalesce(array_length(v_tokens, 1), 0) = 0 or array_length(v_tokens, 1) > 8 then
    return null;
  end if;

  foreach v_token in array v_tokens
  loop
    v_resolved := null;

    select a.canonical_term
      into v_resolved
    from public.search_query_aliases a
    where a.is_active
      and (a.alias_normalized = v_token or a.canonical_normalized = v_token)
    order by
      case when a.canonical_normalized = v_token then 0 else 1 end,
      case a.kind when 'brand' then 0 when 'category' then 1 when 'synonym' then 2 else 3 end,
      a.id
    limit 1;

    if v_resolved is null and v_token ~ '^[a-z0-9_.-]+$' then
      v_resolved := public.search_latin_to_georgian(v_token);
    end if;

    v_output := array_append(v_output, coalesce(nullif(btrim(v_resolved), ''), v_token));
  end loop;

  return nullif(array_to_string(v_output, ' '), '');
end;
$$;

revoke all on function public.search_normalize_query_tokens(text) from public;

create or replace function public.get_search_query_expansions(p_query text)
returns table(term text, source text, priority integer)
language sql
stable
security definer
set search_path = ''
as $$
with q as (
  select lower(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))) as value
),
matched_groups as (
  select distinct a.canonical_normalized
  from public.search_query_aliases a
  cross join q
  where a.is_active
    and (a.alias_normalized = q.value or a.canonical_normalized = q.value)
),
alias_terms as (
  select distinct a.canonical_term as term, 'alias'::text as source, 10 as priority
  from public.search_query_aliases a
  join matched_groups g on g.canonical_normalized = a.canonical_normalized
  where a.is_active
  union
  select distinct a.alias as term, 'alias'::text as source, 20 as priority
  from public.search_query_aliases a
  join matched_groups g on g.canonical_normalized = a.canonical_normalized
  where a.is_active
),
normalized_phrase as (
  select public.search_normalize_query_tokens(q.value) as term, 'normalized'::text as source, 5 as priority
  from q
),
transliterated as (
  select public.search_latin_to_georgian(q.value) as term, 'transliteration'::text as source, 30 as priority
  from q
  where q.value ~ '^[a-z0-9[:space:]_.-]+$'
)
select distinct on (lower(x.term)) x.term, x.source, x.priority
from (
  select * from normalized_phrase
  union all
  select * from alias_terms
  union all
  select * from transliterated
) x
cross join q
where nullif(btrim(x.term), '') is not null
  and lower(btrim(x.term)) <> q.value
order by lower(x.term), x.priority;
$$;

revoke all on function public.get_search_query_expansions(text) from public;
grant execute on function public.get_search_query_expansions(text) to anon, authenticated;

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
      + case when t.source = 'normalized' then 10 when t.source = 'alias' then 8 when t.source = 'transliteration' then 6 else 0 end
    )::double precision as relevance_score
  from public.listings_catalog lc
  cross join normalized n
  cross join config c
  cross join terms t
  where lc.status = 'active'
    and (
      case
        when position(' ' in btrim(t.term)) > 0 then not exists (
          select 1
          from regexp_split_to_table(btrim(t.term), '\s+') as token(value)
          where char_length(token.value) >= 2
            and not (
              lc.title ilike '%' || token.value || '%'
              or coalesce(lc.description, '') ilike '%' || token.value || '%'
              or coalesce(lc.category_name, '') ilike '%' || token.value || '%'
              or coalesce(lc.brand_name, '') ilike '%' || token.value || '%'
              or greatest(
                extensions.word_similarity(lower(token.value), lower(coalesce(lc.title, ''))),
                extensions.word_similarity(lower(token.value), lower(coalesce(lc.brand_name, ''))),
                extensions.word_similarity(lower(token.value), lower(coalesce(lc.category_name, '')))
              ) >= c.rescue_fuzzy_threshold
            )
        )
        else (
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
      end
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
