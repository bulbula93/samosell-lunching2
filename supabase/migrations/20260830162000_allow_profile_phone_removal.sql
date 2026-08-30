-- Profile phone is optional. A valid phone is required only when a listing is
-- published/activated; that rule remains enforced by enforce_active_listing_seller_phone.

drop trigger if exists protect_active_listing_seller_phone on public.profiles;
drop function if exists public.protect_active_listing_seller_phone();
