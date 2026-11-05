-- Ownership uses the existing <auth.uid()>/... object namespace.
-- Do not change bucket visibility, existing objects, or unrelated buckets.
begin;
drop policy if exists "authenticated can insert avatars and branding" on storage.objects;
drop policy if exists "authenticated can update avatars and branding" on storage.objects;
drop policy if exists "authenticated can delete avatars and branding" on storage.objects;

drop policy if exists "public can view avatars" on storage.objects;
create policy "public can view avatars" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
drop policy if exists "authenticated can upload own avatars" on storage.objects;
create policy "authenticated can upload own avatars" on storage.objects for insert to authenticated

with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "authenticated can update own avatars" on storage.objects;
create policy "authenticated can update own avatars" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "authenticated can delete own avatars" on storage.objects;
create policy "authenticated can delete own avatars" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "public can view store branding" on storage.objects;
create policy "public can view store branding" on storage.objects for select to anon, authenticated using (bucket_id = 'store-branding');
drop policy if exists "authenticated can upload own store branding" on storage.objects;
create policy "authenticated can upload own store branding" on storage.objects for insert to authenticated

with check (bucket_id = 'store-branding' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "authenticated can update own store branding" on storage.objects;
create policy "authenticated can update own store branding" on storage.objects for update to authenticated
using (bucket_id = 'store-branding' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'store-branding' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "authenticated can delete own store branding" on storage.objects;
create policy "authenticated can delete own store branding" on storage.objects for delete to authenticated
using (bucket_id = 'store-branding' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Restrictive guards also block an accidentally added permissive grant.
drop policy if exists "branding namespace guard insert" on storage.objects;
create policy "branding namespace guard insert" on storage.objects as restrictive for insert to anon, authenticated

with check (bucket_id not in ('avatars', 'store-branding') or ((select auth.uid()) is not null and (storage.foldername(name))[1] = (select auth.uid())::text));

-- Restrictive guards also block an accidentally added permissive grant.
drop policy if exists "branding namespace guard update" on storage.objects;
create policy "branding namespace guard update" on storage.objects as restrictive for update to anon, authenticated
using (bucket_id not in ('avatars', 'store-branding') or ((select auth.uid()) is not null and (storage.foldername(name))[1] = (select auth.uid())::text))
with check (bucket_id not in ('avatars', 'store-branding') or ((select auth.uid()) is not null and (storage.foldername(name))[1] = (select auth.uid())::text));

-- Restrictive guards also block an accidentally added permissive grant.
drop policy if exists "branding namespace guard delete" on storage.objects;
create policy "branding namespace guard delete" on storage.objects as restrictive for delete to anon, authenticated
using (bucket_id not in ('avatars', 'store-branding') or ((select auth.uid()) is not null and (storage.foldername(name))[1] = (select auth.uid())::text));

-- Internal operational metrics have no public UI callers. Keep service workflows.
CREATE OR REPLACE FUNCTION public.marketing_growth_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with seller_counts as (
    select l.seller_id, count(*)::int as active_count
    from public.listings l
    where l.status = 'active'
    group by l.seller_id
  )
  select jsonb_build_object(
    'generatedAt', now(),
    'activeListings', (select count(*) from public.listings where status = 'active'),
    'listings24h', (
      select count(*) from public.listings
      where created_at >= now() - interval '24 hours'
        and status in ('pending_review','active','reserved','sold')
    ),
    'listings7d', (
      select count(*) from public.listings
      where created_at >= now() - interval '7 days'
        and status in ('pending_review','active','reserved','sold')
    ),
    'newProfiles24h', (
      select count(*) from public.profiles
      where created_at >= now() - interval '24 hours'
    ),
    'newProfiles7d', (
      select count(*) from public.profiles
      where created_at >= now() - interval '7 days'
    ),
    'chats7d', (
      select count(*) from public.chats
      where created_at >= now() - interval '7 days'
    ),
    'sold7d', (
      select count(*) from public.listings
      where status = 'sold'
        and updated_at >= now() - interval '7 days'
    ),
    'sellersWithActiveListings', (select count(*) from seller_counts),
    'activatedSellers', (select count(*) from seller_counts where active_count >= 3),
    'warmSellers', (select count(*) from seller_counts where active_count between 1 and 2),
    'singleListingSellers', (select count(*) from seller_counts where active_count = 1)
  );
$function$;

revoke all on function public.marketing_growth_snapshot() from public, anon, authenticated;
grant execute on function public.marketing_growth_snapshot() to service_role;
-- All relations inside this public aggregate are already schema-qualified.
alter function public.get_public_seller_listing_counts(uuid) set search_path = '';
commit;
