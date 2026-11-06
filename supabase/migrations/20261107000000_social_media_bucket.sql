-- Social Media Agent OS: public bucket for Instagram-ready JPEGs (1080x1350) converted from listing photos.
-- Writes happen only server-side with the service role; no client INSERT/UPDATE/DELETE policies are added.
-- Public read is required because Meta fetches image_url anonymously.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media', 'social-media', true, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];
