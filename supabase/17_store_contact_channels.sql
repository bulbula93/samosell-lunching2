alter table public.profiles
  add column if not exists store_whatsapp text,
  add column if not exists store_telegram text;
