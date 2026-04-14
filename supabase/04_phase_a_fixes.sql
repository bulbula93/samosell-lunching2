drop policy if exists "public can read categories" on public.categories;

create policy "public can read categories"
on public.categories
for select
to anon, authenticated
using (true);
