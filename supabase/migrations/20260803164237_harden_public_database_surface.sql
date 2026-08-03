-- Make the public trust view obey the caller's RLS policies.
alter view public.seller_trust_summary
  set (security_invoker = true);

-- Trigger functions are invoked by Postgres triggers and must not be exposed
-- as callable Data API RPC endpoints.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_message_metadata() from public, anon, authenticated;
revoke execute on function public.sync_listing_favorites_count() from public, anon, authenticated;

-- The rate-limit RPC is intentionally available only to signed-in users.
revoke execute on function public.consume_action_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_action_rate_limit(text, integer, integer) to authenticated;

-- Keep the generic timestamp trigger independent of a caller-controlled path.
alter function public.set_updated_at()
  set search_path = pg_catalog;

-- Public buckets serve object URLs without a broad storage.objects SELECT
-- policy. Signed-in owners retain SELECT for replacement/upsert workflows.
drop policy if exists "public can view listing images" on storage.objects;
drop policy if exists "authenticated can read own listing images" on storage.objects;
create policy "authenticated can read own listing images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
