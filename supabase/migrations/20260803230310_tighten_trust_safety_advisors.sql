-- Follow-up for the live database after the Phase 6 advisor pass.
-- Idempotent so fresh databases can safely run it after the foundation migration.

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;

revoke all on function public.is_current_user_admin()
  from public, anon;
grant execute on function public.is_current_user_admin() to authenticated;

drop policy if exists "users can read own reports" on public.listing_reports;
drop policy if exists "admins can read all reports" on public.listing_reports;
drop policy if exists "users can read own listing reports" on public.listing_reports;
drop policy if exists "admins can read all listing reports" on public.listing_reports;
drop policy if exists "reporters and admins can read listing reports" on public.listing_reports;
create policy "reporters and admins can read listing reports"
on public.listing_reports
for select
to authenticated
using (
  reporter_id = (select auth.uid())
  or (select public.is_current_user_admin())
);

drop policy if exists "users can read own user reports" on public.user_reports;
drop policy if exists "admins can read all user reports" on public.user_reports;
drop policy if exists "reporters and admins can read user reports" on public.user_reports;
create policy "reporters and admins can read user reports"
on public.user_reports
for select
to authenticated
using (
  reporter_id = (select auth.uid())
  or (select public.is_current_user_admin())
);

create index if not exists listing_reports_seller_idx
  on public.listing_reports (seller_id);

create index if not exists listing_reports_reviewed_by_idx
  on public.listing_reports (reviewed_by)
  where reviewed_by is not null;

create index if not exists user_reports_context_listing_idx
  on public.user_reports (context_listing_id)
  where context_listing_id is not null;

create index if not exists user_reports_reviewed_by_idx
  on public.user_reports (reviewed_by)
  where reviewed_by is not null;

create index if not exists moderation_audit_actor_idx
  on public.moderation_audit_log (actor_id, created_at desc);

create index if not exists moderation_audit_target_listing_idx
  on public.moderation_audit_log (target_listing_id)
  where target_listing_id is not null;

create index if not exists moderation_audit_target_user_idx
  on public.moderation_audit_log (target_user_id)
  where target_user_id is not null;
