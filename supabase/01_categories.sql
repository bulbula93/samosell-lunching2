create table if not exists public.categories (
  id bigint primary key generated always as identity,
  name text not null,
  slug text not null unique,
  created_at timestamp with time zone default now()
);

insert into public.categories (name, slug)
values
  ('ქალის ტანსაცმელი', 'women'),
  ('კაცის ტანსაცმელი', 'men'),
  ('აქსესუარები', 'accessories'),
  ('ვინტაჟი', 'vintage')
on conflict (slug) do nothing;

alter table public.categories enable row level security;

drop policy if exists "public can read categories" on public.categories;

create policy "public can read categories"
on public.categories
for select
to anon, authenticated
using (true);

-- Explicit Data API privileges: replay safely without Supabase default grants.
grant select on table public.categories to anon, authenticated;
grant select, insert, update, delete on table public.categories to service_role;
grant usage, select on sequence public.categories_id_seq to service_role;
