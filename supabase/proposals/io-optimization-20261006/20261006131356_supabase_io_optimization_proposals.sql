-- DRAFT / NOT APPLIED. Atomic RLS replacement preserving the live predicates.
-- Re-read policies before approved deployment. Abort on drift; never weaken owner scope.
-- This is deliberately outside supabase/migrations and is not auto-applied.
begin;
set local lock_timeout = '3s';
do $migration$
declare
  public_predicate text;
  owner_predicate text;
begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'ads' and cmd = 'SELECT') <> 2 then
    raise exception 'ads SELECT policies changed; re-audit before applying';
  end if;
  select qual into public_predicate from pg_policies
    where schemaname = 'public' and tablename = 'ads'
      and policyname = 'public can read currently active ads'
      and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and roles = array['anon', 'authenticated']::name[];
  select qual into owner_predicate from pg_policies
    where schemaname = 'public' and tablename = 'ads'
      and policyname = 'users can read own submitted ads'
      and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and roles = array['authenticated']::name[];
  if public_predicate is null or owner_predicate is null then
    raise exception 'Expected public/owner policies absent; re-audit before applying';
  end if;
  -- Roles become disjoint; authenticated visibility remains exactly public OR own.
  execute 'drop policy "public can read currently active ads" on public.ads';
  execute 'drop policy "users can read own submitted ads" on public.ads';
  execute format('create policy "public can read currently active ads" on public.ads for select to anon using (%s)', public_predicate);
  execute format('create policy "authenticated can read active or own ads" on public.ads for select to authenticated using ((%s) OR (%s))', public_predicate, owner_predicate);
end;
$migration$;
commit;
