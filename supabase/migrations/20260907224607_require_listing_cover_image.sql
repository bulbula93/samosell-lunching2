-- Image-less listings are removed from production separately after a read-only
-- dependency audit. Enforce the invariant for all future listing writes.
alter table public.listings
  add constraint listings_cover_image_required
  check (nullif(btrim(cover_image_url), '') is not null)
  not valid;

alter table public.listings
  validate constraint listings_cover_image_required;
