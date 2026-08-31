alter function public.search_catalog_ranked(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer, text)
  rename to search_catalog_ranked_primary;

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
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_primary jsonb;
  v_rescue jsonb;
begin
  v_primary := public.search_catalog_ranked_primary(
    p_query,
    p_category_slug,
    p_item_keywords,
    p_brand,
    p_size,
    p_color,
    p_city,
    p_condition,
    p_gender,
    p_vip,
    p_min_price,
    p_max_price,
    p_offset,
    p_limit,
    p_ranking_version
  );

  if coalesce((v_primary->>'total_count')::integer, 0) > 0 then
    return v_primary;
  end if;

  v_rescue := public.search_catalog_rescue(
    p_query,
    p_category_slug,
    p_item_keywords,
    p_brand,
    p_size,
    p_color,
    p_city,
    p_condition,
    p_gender,
    p_vip,
    p_min_price,
    p_max_price,
    p_offset,
    p_limit,
    p_ranking_version
  );

  return coalesce(v_rescue, v_primary);
end;
$$;

revoke all on function public.search_catalog_ranked(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer, text) from public;
grant execute on function public.search_catalog_ranked(text, text, text[], text, text, text, text, text, text, boolean, numeric, numeric, integer, integer, text) to anon, authenticated;
