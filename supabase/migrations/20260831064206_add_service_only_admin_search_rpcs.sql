create or replace function public.admin_list_search_aliases_service(p_actor_id uuid)
returns table (
  id bigint,
  canonical_term text,
  alias text,
  kind text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = p_actor_id), false) then
    raise exception using errcode = 'P0001', message = 'admin_required';
  end if;

  return query
  select a.id, a.canonical_term, a.alias, a.kind, a.is_active, a.created_at, a.updated_at
  from public.search_query_aliases a
  order by a.canonical_normalized, a.alias_normalized;
end;
$$;

revoke all on function public.admin_list_search_aliases_service(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_search_aliases_service(uuid) to service_role;

create or replace function public.admin_list_search_experiments_service(p_actor_id uuid)
returns table (
  id uuid,
  name text,
  control_version text,
  treatment_version text,
  treatment_percent smallint,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = p_actor_id), false) then
    raise exception using errcode = 'P0001', message = 'admin_required';
  end if;

  return query
  select e.id, e.name, e.control_version, e.treatment_version, e.treatment_percent, e.status, e.starts_at, e.ends_at, e.created_at
  from public.search_ranking_experiments e
  order by e.created_at desc;
end;
$$;

revoke all on function public.admin_list_search_experiments_service(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_search_experiments_service(uuid) to service_role;

create or replace function public.admin_upsert_search_alias_service(
  p_actor_id uuid,
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
  if not coalesce((select p.is_admin from public.profiles p where p.id = p_actor_id), false) then
    raise exception using errcode = 'P0001', message = 'admin_required';
  end if;
  if char_length(v_canonical) < 1 or char_length(v_canonical) > 120 then
    raise exception using errcode = '22023', message = 'invalid_canonical_term';
  end if;
  if char_length(v_alias) < 1 or char_length(v_alias) > 120 then
    raise exception using errcode = '22023', message = 'invalid_alias';
  end if;
  if v_kind not in ('synonym', 'transliteration', 'brand', 'category') then
    raise exception using errcode = '22023', message = 'invalid_alias_kind';
  end if;

  insert into public.search_query_aliases (canonical_term, alias, kind, is_active, created_by)
  values (v_canonical, v_alias, v_kind, true, p_actor_id)
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

revoke all on function public.admin_upsert_search_alias_service(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_upsert_search_alias_service(uuid, text, text, text) to service_role;

create or replace function public.admin_delete_search_alias_service(p_actor_id uuid, p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = p_actor_id), false) then
    raise exception using errcode = 'P0001', message = 'admin_required';
  end if;

  delete from public.search_query_aliases where id = p_id;
  return found;
end;
$$;

revoke all on function public.admin_delete_search_alias_service(uuid, bigint) from public, anon, authenticated;
grant execute on function public.admin_delete_search_alias_service(uuid, bigint) to service_role;

create or replace function public.get_search_analytics_summary_service(p_actor_id uuid, p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_result jsonb;
begin
  if not coalesce((select p.is_admin from public.profiles p where p.id = p_actor_id), false) then
    raise exception using errcode = 'P0001', message = 'admin_required';
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

revoke all on function public.get_search_analytics_summary_service(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_search_analytics_summary_service(uuid, integer) to service_role;
