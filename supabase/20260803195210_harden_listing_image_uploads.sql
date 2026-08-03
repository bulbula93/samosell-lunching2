-- Phase 3: enforce the same upload limits at the Storage boundary as the UI/server.
-- Existing objects are not modified or removed.

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'listing-images'
  ) then
    raise exception 'Required storage bucket listing-images does not exist';
  end if;
end
$$;

update storage.buckets
set
  file_size_limit = 7340032,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'listing-images';
