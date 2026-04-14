insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "public can view avatars" on storage.objects;
create policy "public can view avatars"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "authenticated can upload own avatars" on storage.objects;
create policy "authenticated can upload own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated can update own avatars" on storage.objects;
create policy "authenticated can update own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated can delete own avatars" on storage.objects;
create policy "authenticated can delete own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
