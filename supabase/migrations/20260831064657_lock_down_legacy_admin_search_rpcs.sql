-- Admin Search now runs through service-role-only RPCs after requireAdminUser().
-- The legacy authenticated/anon entry points are retained only as inert definitions
-- so older migrations remain understandable, but they are no longer callable via API roles.

revoke all on function public.admin_delete_search_alias(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_search_aliases()
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_search_experiments()
  from public, anon, authenticated, service_role;
revoke all on function public.admin_upsert_search_alias(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_search_analytics_summary(integer)
  from public, anon, authenticated, service_role;

-- No production code currently invokes direct ranking-config mutation. Keep it closed
-- until a service-only admin workflow is explicitly implemented.
revoke all on function public.update_search_ranking_config(text, jsonb)
  from public, anon, authenticated, service_role;
