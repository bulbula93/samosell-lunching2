alter table public.profiles
  add column if not exists store_phone text,
  add column if not exists store_instagram text,
  add column if not exists store_facebook text,
  add column if not exists store_website text,
  add column if not exists store_hours text,
  add column if not exists store_address text,
  add column if not exists store_map_url text;
