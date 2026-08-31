create table if not exists public.search_query_aliases (
  id bigint generated always as identity primary key,
  canonical_term text not null,
  alias text not null,
  kind text not null default 'synonym' check (kind in ('synonym', 'transliteration', 'brand', 'category')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canonical_normalized text generated always as (lower(btrim(canonical_term))) stored,
  alias_normalized text generated always as (lower(btrim(alias))) stored,
  constraint search_query_aliases_canonical_length check (char_length(btrim(canonical_term)) between 1 and 120),
  constraint search_query_aliases_alias_length check (char_length(btrim(alias)) between 1 and 120),
  constraint search_query_aliases_alias_unique unique (alias_normalized)
);

create index if not exists search_query_aliases_canonical_idx
  on public.search_query_aliases (canonical_normalized)
  where is_active;

alter table public.search_query_aliases enable row level security;
revoke all on table public.search_query_aliases from anon, authenticated;

insert into public.search_query_aliases (canonical_term, alias, kind)
values
  ('ჯინსები', 'ჯინსი', 'synonym'),
  ('ჯინსები', 'jeans', 'synonym'),
  ('ჰუდი', 'hoodie', 'synonym'),
  ('ჰუდი', 'hudi', 'transliteration'),
  ('სვიტერი', 'ჯემპრი', 'synonym'),
  ('სვიტერი', 'sweater', 'synonym'),
  ('კედი', 'კედები', 'synonym'),
  ('კედი', 'sneaker', 'synonym'),
  ('კედი', 'sneakers', 'synonym'),
  ('ქურთუკი', 'kurtka', 'synonym'),
  ('ქურთუკი', 'jacket', 'synonym'),
  ('კაბა', 'dress', 'synonym'),
  ('კაბა', 'kaba', 'transliteration'),
  ('ჩანთა', 'bag', 'synonym'),
  ('ჩანთა', 'bags', 'synonym'),
  ('ფეხსაცმელი', 'shoe', 'synonym'),
  ('ფეხსაცმელი', 'shoes', 'synonym'),
  ('Nike', 'ნაიკი', 'brand'),
  ('Adidas', 'ადიდასი', 'brand'),
  ('Zara', 'ზარა', 'brand')
on conflict (alias_normalized) do nothing;

create or replace function public.search_latin_to_georgian(p_text text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_text text := lower(p_text);
  v_from text[] := array['a','b','g','d','e','v','z','t','i','k','l','m','n','o','p','j','r','s','u','f','q','c','x','h','w','y'];
  v_to text[] := array['ა','ბ','გ','დ','ე','ვ','ზ','ტ','ი','კ','ლ','მ','ნ','ო','პ','ჯ','რ','ს','უ','ფ','ქ','ც','ხ','ჰ','ვ','ი'];
  v_i integer;
begin
  if v_text !~ '^[a-z0-9[:space:]_.-]+$' then
    return null;
  end if;

  v_text := replace(v_text, 'tsh', 'ჭ');
  v_text := replace(v_text, 'sh', 'შ');
  v_text := replace(v_text, 'ch', 'ჩ');
  v_text := replace(v_text, 'ts', 'ც');
  v_text := replace(v_text, 'dz', 'ძ');
  v_text := replace(v_text, 'zh', 'ჟ');
  v_text := replace(v_text, 'kh', 'ხ');
  v_text := replace(v_text, 'gh', 'ღ');
  v_text := replace(v_text, 'th', 'თ');
  v_text := replace(v_text, 'ph', 'ფ');

  for v_i in 1..array_length(v_from, 1)
  loop
    v_text := replace(v_text, v_from[v_i], v_to[v_i]);
  end loop;

  return nullif(btrim(regexp_replace(v_text, '\s+', ' ', 'g')), '');
end;
$$;

revoke all on function public.search_latin_to_georgian(text) from public;
grant execute on function public.search_latin_to_georgian(text) to anon, authenticated;

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
transliterated as (
  select public.search_latin_to_georgian(q.value) as term, 'transliteration'::text as source, 30 as priority
  from q
  where q.value ~ '^[a-z0-9[:space:]_.-]+$'
)
select distinct on (lower(x.term)) x.term, x.source, x.priority
from (
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

create table if not exists public.search_ranking_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  control_version text not null,
  treatment_version text not null,
  treatment_percent smallint not null default 50 check (treatment_percent between 1 and 99),
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint search_ranking_experiments_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint search_ranking_experiments_versions_differ check (control_version <> treatment_version),
  constraint search_ranking_experiments_time_order check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index if not exists search_ranking_one_running_experiment_idx
  on public.search_ranking_experiments ((status))
  where status = 'running';

alter table public.search_ranking_experiments enable row level security;
revoke all on table public.search_ranking_experiments from anon, authenticated;

alter table public.search_impressions
  add column if not exists experiment_id uuid references public.search_ranking_experiments(id) on delete set null,
  add column if not exists experiment_variant text check (experiment_variant is null or experiment_variant in ('control', 'treatment'));

create index if not exists search_impressions_experiment_idx
  on public.search_impressions (experiment_id, experiment_variant, created_at desc)
  where experiment_id is not null;

create or replace function public.get_search_experiment_assignment(p_search_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_experiment public.search_ranking_experiments%rowtype;
  v_current_version text;
  v_seed text;
  v_bucket integer;
  v_variant text := 'control';
  v_version text;
begin
  select c.version into v_current_version
  from public.search_ranking_config c
  where c.id = 1;
  v_current_version := coalesce(v_current_version, 'phase10-v1');

  if p_search_id is null then
    return jsonb_build_object(
      'experiment_id', null,
      'variant', 'control',
      'ranking_version', v_current_version
    );
  end if;

  select e.* into v_experiment
  from public.search_ranking_experiments e
  where e.status = 'running'
    and coalesce(e.starts_at, '-infinity'::timestamptz) <= now()
    and coalesce(e.ends_at, 'infinity'::timestamptz) > now()
  order by e.starts_at desc nulls last, e.created_at desc
  limit 1;

  if v_experiment.id is null then
    return jsonb_build_object(
      'experiment_id', null,
      'variant', 'control',
      'ranking_version', v_current_version
    );
  end if;

  v_seed := coalesce(auth.uid()::text, p_search_id::text);
  v_bucket := mod(abs(hashtextextended(v_seed, 1101)::numeric), 100)::integer;
  if v_bucket < v_experiment.treatment_percent then
    v_variant := 'treatment';
    v_version := v_experiment.treatment_version;
  else
    v_variant := 'control';
    v_version := v_experiment.control_version;
  end if;

  return jsonb_build_object(
    'experiment_id', v_experiment.id,
    'variant', v_variant,
    'ranking_version', v_version
  );
end;
$$;

revoke all on function public.get_search_experiment_assignment(uuid) from public;
grant execute on function public.get_search_experiment_assignment(uuid) to anon, authenticated;

create or replace function public.record_search_impression(
  p_search_id uuid,
  p_query text,
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'relevance',
  p_page integer default 1,
  p_result_count integer default 0,
  p_listing_ids uuid[] default '{}'::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text;
  v_normalized_query text;
  v_filters jsonb;
  v_sort text;
  v_version text;
  v_assignment jsonb;
  v_experiment_id uuid;
  v_experiment_variant text;
begin
  if p_search_id is null then
    return false;
  end if;

  v_query := btrim(coalesce(p_query, ''));
  if char_length(v_query) < 1 or char_length(v_query) > 200 then
    return false;
  end if;

  v_normalized_query := lower(regexp_replace(v_query, '\s+', ' ', 'g'));
  v_filters := case
    when jsonb_typeof(coalesce(p_filters, '{}'::jsonb)) = 'object' then coalesce(p_filters, '{}'::jsonb)
    else '{}'::jsonb
  end;
  if octet_length(v_filters::text) > 8192 then
    return false;
  end if;

  v_sort := left(coalesce(nullif(btrim(p_sort), ''), 'relevance'), 32);

  if v_sort = 'relevance' then
    v_assignment := public.get_search_experiment_assignment(p_search_id);
    v_version := nullif(v_assignment->>'ranking_version', '');
    v_experiment_id := nullif(v_assignment->>'experiment_id', '')::uuid;
    v_experiment_variant := nullif(v_assignment->>'variant', '');
  end if;

  if v_version is null then
    select c.version into v_version
    from public.search_ranking_config c
    where c.id = 1;
  end if;
  v_version := coalesce(v_version, 'phase10-v1');

  insert into public.search_impressions (
    id,
    user_id,
    query,
    normalized_query,
    filters,
    sort,
    page,
    result_count,
    shown_listing_ids,
    ranking_version,
    experiment_id,
    experiment_variant
  )
  values (
    p_search_id,
    auth.uid(),
    v_query,
    v_normalized_query,
    v_filters,
    v_sort,
    least(greatest(coalesce(p_page, 1), 1), 10000),
    greatest(coalesce(p_result_count, 0), 0),
    coalesce(p_listing_ids[1:100], '{}'::uuid[]),
    v_version,
    v_experiment_id,
    v_experiment_variant
  )
  on conflict (id) do nothing;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.record_search_impression(uuid, text, jsonb, text, integer, integer, uuid[]) from public;
grant execute on function public.record_search_impression(uuid, text, jsonb, text, integer, integer, uuid[]) to anon, authenticated;

drop function if exists public.search_catalog_ranked(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer);

create function public.search_catalog_ranked(
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
$$;

revoke all on function public.search_catalog_ranked(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer, text) from public;
grant execute on function public.search_catalog_ranked(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer, text) to anon, authenticated;

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
    greatest(0.28, coalesce((d.weights->>'fuzzy_threshold')::double precision, 0.42) - 0.14) as rescue_fuzzy_threshold
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

create or replace function public.admin_list_search_aliases()
returns table(id bigint, canonical_term text, alias text, kind text, is_active boolean, created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) then
    raise exception 'admin_required';
  end if;

  return query
  select a.id, a.canonical_term, a.alias, a.kind, a.is_active, a.created_at, a.updated_at
  from public.search_query_aliases a
  order by a.canonical_normalized, a.alias_normalized;
end;
$$;

revoke all on function public.admin_list_search_aliases() from public;
grant execute on function public.admin_list_search_aliases() to authenticated;

create or replace function public.admin_upsert_search_alias(
  p_canonical_term text,
  p_alias text,
  p_kind text default 'synonym'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_canonical text := btrim(coalesce(p_canonical_term, ''));
  v_alias text := btrim(coalesce(p_alias, ''));
  v_kind text := lower(btrim(coalesce(p_kind, 'synonym')));
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) then
    raise exception 'admin_required';
  end if;
  if char_length(v_canonical) < 1 or char_length(v_canonical) > 120 then
    raise exception 'invalid_canonical_term';
  end if;
  if char_length(v_alias) < 1 or char_length(v_alias) > 120 then
    raise exception 'invalid_alias';
  end if;
  if v_kind not in ('synonym', 'transliteration', 'brand', 'category') then
    raise exception 'invalid_alias_kind';
  end if;

  insert into public.search_query_aliases (canonical_term, alias, kind, is_active, created_by)
  values (v_canonical, v_alias, v_kind, true, auth.uid())
  on conflict (alias_normalized) do update
  set canonical_term = excluded.canonical_term,
      alias = excluded.alias,
      kind = excluded.kind,
      is_active = true,
      updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_search_alias(text, text, text) from public;
grant execute on function public.admin_upsert_search_alias(text, text, text) to authenticated;

create or replace function public.admin_delete_search_alias(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) then
    raise exception 'admin_required';
  end if;
  delete from public.search_query_aliases where id = p_id;
  return found;
end;
$$;

revoke all on function public.admin_delete_search_alias(bigint) from public;
grant execute on function public.admin_delete_search_alias(bigint) to authenticated;

create or replace function public.admin_list_search_experiments()
returns table(id uuid, name text, control_version text, treatment_version text, treatment_percent smallint, status text, starts_at timestamptz, ends_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false) then
    raise exception 'admin_required';
  end if;

  return query
  select e.id, e.name, e.control_version, e.treatment_version, e.treatment_percent, e.status, e.starts_at, e.ends_at, e.created_at
  from public.search_ranking_experiments e
  order by e.created_at desc;
end;
$$;

revoke all on function public.admin_list_search_experiments() from public;
grant execute on function public.admin_list_search_experiments() to authenticated;
