alter table public.profiles
  add column if not exists store_logo_url text,
  add column if not exists store_banner_url text;

insert into storage.buckets (id, name, public)
values ('store-branding', 'store-branding', true)
on conflict (id) do update set public = true;

drop policy if exists "public can view store branding" on storage.objects;
create policy "public can view store branding"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'store-branding');

drop policy if exists "authenticated can upload own store branding" on storage.objects;
create policy "authenticated can upload own store branding"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'store-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated can update own store branding" on storage.objects;
create policy "authenticated can update own store branding"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'store-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'store-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated can delete own store branding" on storage.objects;
create policy "authenticated can delete own store branding"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'store-branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);
