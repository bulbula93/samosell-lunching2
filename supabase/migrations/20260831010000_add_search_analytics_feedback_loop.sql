create table if not exists public.search_ranking_config (
  id smallint primary key check (id = 1),
  version text not null,
  weights jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.search_ranking_config (id, version, weights)
values (
  1,
  'phase10-v1',
  jsonb_build_object(
    'title_exact', 100,
    'brand_exact', 80,
    'title_prefix', 55,
    'title_contains', 40,
    'brand_contains', 35,
    'category_contains', 20,
    'description_contains', 8,
    'title_fuzzy', 35,
    'brand_fuzzy', 28,
    'category_fuzzy', 18,
    'cover_image', 2,
    'verified_seller', 2,
    'favorites_cap', 5,
    'views_cap', 3,
    'fresh_7d', 4,
    'fresh_30d', 2,
    'fresh_90d', 1,
    'promotion_tier', 1.25,
    'fuzzy_threshold', 0.42
  )
)
on conflict (id) do nothing;

alter table public.search_ranking_config enable row level security;

drop policy if exists search_ranking_config_read on public.search_ranking_config;
create policy search_ranking_config_read
on public.search_ranking_config
for select
to anon, authenticated
using (true);

create table if not exists public.search_ranking_config_history (
  id bigint generated always as identity primary key,
  version text not null,
  weights jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.search_ranking_config_history enable row level security;

insert into public.search_ranking_config_history (version, weights)
select version, weights
from public.search_ranking_config c
where c.id = 1
  and not exists (
    select 1
    from public.search_ranking_config_history h
    where h.version = c.version
  );

create table if not exists public.search_impressions (
  id uuid primary key,
  user_id uuid references public.profiles(id) on delete set null,
  query text not null,
  normalized_query text not null,
  filters jsonb not null default '{}'::jsonb,
  sort text not null default 'relevance',
  page integer not null default 1 check (page >= 1 and page <= 10000),
  result_count integer not null default 0 check (result_count >= 0),
  shown_listing_ids uuid[] not null default '{}'::uuid[],
  ranking_version text not null,
  created_at timestamptz not null default now(),
  constraint search_impressions_query_length check (char_length(query) between 1 and 200),
  constraint search_impressions_normalized_query_length check (char_length(normalized_query) between 1 and 200),
  constraint search_impressions_filters_size check (octet_length(filters::text) <= 8192),
  constraint search_impressions_shown_limit check (coalesce(cardinality(shown_listing_ids), 0) <= 100)
);

create index if not exists search_impressions_created_at_idx
  on public.search_impressions (created_at desc);
create index if not exists search_impressions_normalized_query_idx
  on public.search_impressions (normalized_query, created_at desc);
create index if not exists search_impressions_user_idx
  on public.search_impressions (user_id, created_at desc)
  where user_id is not null;

alter table public.search_impressions enable row level security;

create table if not exists public.search_interactions (
  id bigint generated always as identity primary key,
  search_id uuid not null references public.search_impressions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  event_type text not null check (event_type in ('click', 'favorite', 'chat_start')),
  position integer check (position is null or position >= 1),
  created_at timestamptz not null default now(),
  constraint search_interactions_unique_signal unique (search_id, event_type, listing_id)
);

create index if not exists search_interactions_search_idx
  on public.search_interactions (search_id, created_at);
create index if not exists search_interactions_event_idx
  on public.search_interactions (event_type, created_at desc);
create index if not exists search_interactions_listing_idx
  on public.search_interactions (listing_id, event_type, created_at desc)
  where listing_id is not null;

alter table public.search_interactions enable row level security;

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
  select c.version into v_version
  from public.search_ranking_config c
  where c.id = 1;
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
    ranking_version
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
    v_version
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

create or replace function public.record_search_interaction(
  p_search_id uuid,
  p_event_type text,
  p_listing_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page integer;
  v_listing_ids uuid[];
  v_local_position integer;
  v_position integer;
begin
  if p_search_id is null or p_listing_id is null then
    return false;
  end if;
  if p_event_type not in ('click', 'favorite', 'chat_start') then
    return false;
  end if;

  select s.page, s.shown_listing_ids
    into v_page, v_listing_ids
  from public.search_impressions s
  where s.id = p_search_id
    and s.created_at >= now() - interval '7 days';

  if v_listing_ids is null then
    return false;
  end if;

  v_local_position := array_position(v_listing_ids, p_listing_id);
  if v_local_position is null then
    return false;
  end if;
  v_position := ((greatest(coalesce(v_page, 1), 1) - 1) * 24) + v_local_position;

  insert into public.search_interactions (
    search_id,
    user_id,
    listing_id,
    event_type,
    position
  )
  values (
    p_search_id,
    auth.uid(),
    p_listing_id,
    p_event_type,
    v_position
  )
  on conflict (search_id, event_type, listing_id) do nothing;

  return true;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.record_search_interaction(uuid, text, uuid) from public;
grant execute on function public.record_search_interaction(uuid, text, uuid) to anon, authenticated;

create or replace function public.update_search_ranking_config(
  p_version text,
  p_weights jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := false;
  v_key text;
  v_value text;
  v_number numeric;
  v_version text;
  v_allowed_keys constant text[] := array[
    'title_exact', 'brand_exact', 'title_prefix', 'title_contains',
    'brand_contains', 'category_contains', 'description_contains',
    'title_fuzzy', 'brand_fuzzy', 'category_fuzzy', 'cover_image',
    'verified_seller', 'favorites_cap', 'views_cap', 'fresh_7d',
    'fresh_30d', 'fresh_90d', 'promotion_tier', 'fuzzy_threshold'
  ];
begin
  select coalesce(p.is_admin, false)
    into v_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required';
  end if;

  v_version := btrim(coalesce(p_version, ''));
  if char_length(v_version) < 1 or char_length(v_version) > 64 then
    raise exception 'invalid_ranking_version';
  end if;
  if jsonb_typeof(p_weights) <> 'object' or p_weights = '{}'::jsonb then
    raise exception 'invalid_ranking_weights';
  end if;

  for v_key, v_value in select key, value from jsonb_each_text(p_weights)
  loop
    if not (v_key = any(v_allowed_keys)) then
      raise exception 'unknown_ranking_weight:%', v_key;
    end if;
    begin
      v_number := v_value::numeric;
    exception when others then
      raise exception 'invalid_ranking_weight:%', v_key;
    end;
    if v_key = 'fuzzy_threshold' then
      if v_number < 0.2 or v_number > 0.8 then
        raise exception 'invalid_fuzzy_threshold';
      end if;
    elsif v_number < 0 or v_number > 200 then
      raise exception 'ranking_weight_out_of_range:%', v_key;
    end if;
  end loop;

  update public.search_ranking_config
  set
    version = v_version,
    weights = weights || p_weights,
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;

  insert into public.search_ranking_config_history (version, weights, changed_by)
  select version, weights, auth.uid()
  from public.search_ranking_config
  where id = 1;

  return true;
end;
$$;

revoke all on function public.update_search_ranking_config(text, jsonb) from public;
grant execute on function public.update_search_ranking_config(text, jsonb) to authenticated;

create or replace function public.get_search_analytics_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_admin boolean := false;
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_result jsonb;
begin
  select coalesce(p.is_admin, false)
    into v_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required';
  end if;

  with scoped as (
    select s.*
    from public.search_impressions s
    where s.created_at >= now() - make_interval(days => v_days)
  ),
  per_search as (
    select
      s.id,
      s.normalized_query,
      s.result_count,
      s.page,
      s.shown_listing_ids,
      count(i.id) filter (where i.event_type = 'click')::integer as clicks,
      count(i.id) filter (where i.event_type = 'favorite')::integer as favorites,
      count(i.id) filter (where i.event_type = 'chat_start')::integer as chat_starts
    from scoped s
    left join public.search_interactions i on i.search_id = s.id
    group by s.id, s.normalized_query, s.result_count, s.page, s.shown_listing_ids
  ),
  query_rollup as (
    select
      normalized_query as query,
      count(*)::integer as searches,
      round(avg(result_count)::numeric, 1) as avg_results,
      count(*) filter (where result_count = 0)::integer as zero_result_searches,
      sum(clicks)::integer as clicks,
      sum(favorites)::integer as favorites,
      sum(chat_starts)::integer as chat_starts,
      count(*) filter (where clicks > 0)::integer as clicked_searches
    from per_search
    group by normalized_query
  ),
  exposures as (
    select
      s.id as search_id,
      listing_id,
      (((s.page - 1) * 24) + ordinality)::integer as position
    from scoped s
    cross join lateral unnest(s.shown_listing_ids) with ordinality as shown(listing_id, ordinality)
  ),
  position_rollup as (
    select
      e.position,
      count(*)::integer as impressions,
      count(i.id) filter (where i.event_type = 'click')::integer as clicks,
      count(i.id) filter (where i.event_type = 'favorite')::integer as favorites,
      count(i.id) filter (where i.event_type = 'chat_start')::integer as chat_starts
    from exposures e
    left join public.search_interactions i
      on i.search_id = e.search_id
      and i.listing_id = e.listing_id
    group by e.position
  )
  select jsonb_build_object(
    'days', v_days,
    'ranking_version', coalesce((select c.version from public.search_ranking_config c where c.id = 1), 'phase10-v1'),
    'searches', (select count(*) from per_search),
    'result_exposures', (select coalesce(sum(cardinality(shown_listing_ids)), 0) from per_search),
    'zero_result_searches', (select count(*) from per_search where result_count = 0),
    'zero_result_rate', (
      select case when count(*) = 0 then 0 else round((count(*) filter (where result_count = 0)::numeric / count(*)::numeric) * 100, 1) end
      from per_search
    ),
    'searches_with_click', (select count(*) from per_search where clicks > 0),
    'search_ctr', (
      select case when count(*) = 0 then 0 else round((count(*) filter (where clicks > 0)::numeric / count(*)::numeric) * 100, 1) end
      from per_search
    ),
    'result_click_rate', (
      select case
        when coalesce(sum(cardinality(shown_listing_ids)), 0) = 0 then 0
        else round((coalesce(sum(clicks), 0)::numeric / sum(cardinality(shown_listing_ids))::numeric) * 100, 2)
      end
      from per_search
    ),
    'favorites', (select coalesce(sum(favorites), 0) from per_search),
    'chat_starts', (select coalesce(sum(chat_starts), 0) from per_search),
    'favorite_rate', (
      select case when count(*) = 0 then 0 else round((coalesce(sum(favorites), 0)::numeric / count(*)::numeric) * 100, 2) end
      from per_search
    ),
    'chat_start_rate', (
      select case when count(*) = 0 then 0 else round((coalesce(sum(chat_starts), 0)::numeric / count(*)::numeric) * 100, 2) end
      from per_search
    ),
    'avg_clicked_position', (
      select coalesce(round(avg(i.position)::numeric, 1), 0)
      from public.search_interactions i
      join scoped s on s.id = i.search_id
      where i.event_type = 'click'
    ),
    'top_queries', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.searches desc, q.clicks desc, q.query)
      from (
        select
          query,
          searches,
          avg_results,
          zero_result_searches,
          clicks,
          favorites,
          chat_starts,
          case when searches = 0 then 0 else round((clicked_searches::numeric / searches::numeric) * 100, 1) end as search_ctr
        from query_rollup
        order by searches desc, clicks desc, query
        limit 20
      ) q
    ), '[]'::jsonb),
    'zero_result_queries', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.searches desc, q.query)
      from (
        select query, searches
        from query_rollup
        where zero_result_searches > 0
        order by zero_result_searches desc, searches desc, query
        limit 20
      ) q
    ), '[]'::jsonb),
    'high_intent_queries', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.chat_starts desc, q.favorites desc, q.clicks desc, q.query)
      from (
        select query, searches, clicks, favorites, chat_starts
        from query_rollup
        where favorites > 0 or chat_starts > 0
        order by chat_starts desc, favorites desc, clicks desc, query
        limit 20
      ) q
    ), '[]'::jsonb),
    'position_metrics', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position', p.position,
          'impressions', p.impressions,
          'clicks', p.clicks,
          'favorites', p.favorites,
          'chat_starts', p.chat_starts,
          'ctr', case when p.impressions = 0 then 0 else round((p.clicks::numeric / p.impressions::numeric) * 100, 2) end
        )
        order by p.position
      )
      from position_rollup p
      where p.position <= 24
    ), '[]'::jsonb)
  ) into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_search_analytics_summary(integer) from public;
grant execute on function public.get_search_analytics_summary(integer) to authenticated;

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
config as (
  select
    coalesce((weights->>'title_exact')::double precision, 100) as title_exact,
    coalesce((weights->>'brand_exact')::double precision, 80) as brand_exact,
    coalesce((weights->>'title_prefix')::double precision, 55) as title_prefix,
    coalesce((weights->>'title_contains')::double precision, 40) as title_contains,
    coalesce((weights->>'brand_contains')::double precision, 35) as brand_contains,
    coalesce((weights->>'category_contains')::double precision, 20) as category_contains,
    coalesce((weights->>'description_contains')::double precision, 8) as description_contains,
    coalesce((weights->>'title_fuzzy')::double precision, 35) as title_fuzzy,
    coalesce((weights->>'brand_fuzzy')::double precision, 28) as brand_fuzzy,
    coalesce((weights->>'category_fuzzy')::double precision, 18) as category_fuzzy,
    coalesce((weights->>'cover_image')::double precision, 2) as cover_image,
    coalesce((weights->>'verified_seller')::double precision, 2) as verified_seller,
    coalesce((weights->>'favorites_cap')::double precision, 5) as favorites_cap,
    coalesce((weights->>'views_cap')::double precision, 3) as views_cap,
    coalesce((weights->>'fresh_7d')::double precision, 4) as fresh_7d,
    coalesce((weights->>'fresh_30d')::double precision, 2) as fresh_30d,
    coalesce((weights->>'fresh_90d')::double precision, 1) as fresh_90d,
    coalesce((weights->>'promotion_tier')::double precision, 1.25) as promotion_tier,
    coalesce((weights->>'fuzzy_threshold')::double precision, 0.42) as fuzzy_threshold
  from public.search_ranking_config
  where id = 1
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
