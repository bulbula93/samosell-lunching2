create index if not exists favorites_user_id_created_at_idx
on public.favorites (user_id, created_at desc);

create index if not exists favorites_listing_id_idx
on public.favorites (listing_id);
