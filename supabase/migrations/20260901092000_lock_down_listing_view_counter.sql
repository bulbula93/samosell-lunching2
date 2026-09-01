revoke all on function public.increment_listing_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_listing_views(uuid) to service_role;
