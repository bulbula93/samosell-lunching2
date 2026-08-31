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
    if v_experiment_id is not null then
      v_experiment_variant := nullif(v_assignment->>'variant', '');
    end if;
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
