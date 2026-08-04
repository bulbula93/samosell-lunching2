-- Phase 6: secure trust and safety foundation.
-- Keeps existing reports and blocks, adds user reports and an immutable
-- moderation audit trail, and narrows every browser write to validated RPCs.

alter table public.listing_reports
  add column if not exists updated_at timestamp with time zone not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.listing_reports'::regclass
      and conname = 'listing_reports_details_length_check'
  ) then
    alter table public.listing_reports
      add constraint listing_reports_details_length_check
      check (char_length(details) <= 2000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.listing_reports'::regclass
      and conname = 'listing_reports_moderation_note_length_check'
  ) then
    alter table public.listing_reports
      add constraint listing_reports_moderation_note_length_check
      check (moderation_note is null or char_length(moderation_note) <= 2000);
  end if;
end
$$;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  context_listing_id uuid references public.listings (id) on delete set null,
  reason text not null
    check (reason in ('spam', 'scam', 'harassment', 'impersonation', 'prohibited', 'other')),
  details text not null default ''
    check (char_length(details) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  moderation_note text
    check (moderation_note is null or char_length(moderation_note) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (reporter_id, reported_user_id),
  check (reporter_id <> reported_user_id)
);

create table if not exists public.moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  report_kind text not null check (report_kind in ('listing', 'user')),
  report_id uuid not null,
  action text not null
    check (action in (
      'mark_reviewing',
      'resolve',
      'dismiss',
      'hide_listing',
      'suspend_user',
      'restore_user'
    )),
  target_listing_id uuid references public.listings (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists user_reports_reporter_created_idx
  on public.user_reports (reporter_id, created_at desc);

create index if not exists user_reports_status_created_idx
  on public.user_reports (status, created_at desc);

create index if not exists user_reports_reported_user_idx
  on public.user_reports (reported_user_id, created_at desc);

create index if not exists moderation_audit_created_idx
  on public.moderation_audit_log (created_at desc);

create index if not exists moderation_audit_report_idx
  on public.moderation_audit_log (report_kind, report_id, created_at desc);

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

alter table public.user_reports enable row level security;
alter table public.moderation_audit_log enable row level security;

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

-- A user may edit their own public profile, but may never grant themselves
-- admin privileges or clear a suspension through a direct profile update.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = new.id then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.is_suspended := false;
    else
      new.is_admin := old.is_admin;
      new.is_suspended := old.is_suspended;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privileged_fields_trigger
  on public.profiles;
create trigger protect_profile_privileged_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_privileged_fields();

revoke execute on function public.protect_profile_privileged_fields()
  from public, anon, authenticated;

drop policy if exists "users can create own reports" on public.listing_reports;
drop policy if exists "admins can update reports" on public.listing_reports;
drop policy if exists "users can read own reports" on public.listing_reports;
drop policy if exists "admins can read all reports" on public.listing_reports;
drop policy if exists "users can read own listing reports" on public.listing_reports;
drop policy if exists "admins can read all listing reports" on public.listing_reports;
create policy "reporters and admins can read listing reports"
on public.listing_reports
for select
to authenticated
using (
  reporter_id = (select auth.uid())
  or (select public.is_current_user_admin())
);

drop policy if exists "users can manage own blocks" on public.user_blocks;
drop policy if exists "involved users can read blocks" on public.user_blocks;
create policy "involved users can read blocks"
on public.user_blocks
for select
to authenticated
using (
  blocker_id = (select auth.uid())
  or blocked_id = (select auth.uid())
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

drop policy if exists "admins can read moderation audit log" on public.moderation_audit_log;
create policy "admins can read moderation audit log"
on public.moderation_audit_log
for select
to authenticated
using ((select public.is_current_user_admin()));

create or replace function public.submit_listing_report(
  p_listing_id uuid,
  p_reason text,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter_id uuid := auth.uid();
  v_seller_id uuid;
  v_report_id uuid;
  v_details text := btrim(coalesce(p_details, ''));
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_reporter_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if p_reason is null or p_reason not in (
    'spam', 'fake', 'prohibited', 'abuse', 'wrong_info', 'other'
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_report_reason';
  end if;

  if char_length(v_details) > 2000 then
    raise exception using errcode = 'P0001', message = 'report_details_too_long';
  end if;

  select l.seller_id
  into v_seller_id
  from public.listings l
  where l.id = p_listing_id
    and l.status in ('active', 'reserved', 'sold');

  if not found then
    raise exception using errcode = 'P0001', message = 'listing_unavailable';
  end if;

  if v_seller_id = v_reporter_id then
    raise exception using errcode = 'P0001', message = 'self_report';
  end if;

  select rate.allowed, rate.retry_after_seconds
  into v_allowed, v_retry_after
  from public.consume_action_rate_limit('listing_report', 3600, 10) rate;

  if not coalesce(v_allowed, false) then
    raise exception using
      errcode = 'P0001',
      message = 'report_rate_limited',
      hint = greatest(coalesce(v_retry_after, 60), 1)::text;
  end if;

  insert into public.listing_reports (
    listing_id,
    reporter_id,
    seller_id,
    reason,
    details,
    status,
    moderation_note,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
  )
  values (
    p_listing_id,
    v_reporter_id,
    v_seller_id,
    p_reason,
    v_details,
    'open',
    null,
    null,
    null,
    now(),
    now()
  )
  on conflict (listing_id, reporter_id)
  do update set
    seller_id = excluded.seller_id,
    reason = excluded.reason,
    details = excluded.details,
    status = 'open',
    moderation_note = null,
    reviewed_by = null,
    reviewed_at = null,
    created_at = now(),
    updated_at = now()
  returning id into v_report_id;

  return v_report_id;
end;
$$;

create or replace function public.submit_user_report(
  p_reported_user_id uuid,
  p_reason text,
  p_details text default '',
  p_context_listing_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter_id uuid := auth.uid();
  v_report_id uuid;
  v_details text := btrim(coalesce(p_details, ''));
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_reporter_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if p_reported_user_id is null or p_reported_user_id = v_reporter_id then
    raise exception using errcode = 'P0001', message = 'self_report';
  end if;

  if p_reason is null or p_reason not in (
    'spam', 'scam', 'harassment', 'impersonation', 'prohibited', 'other'
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_report_reason';
  end if;

  if char_length(v_details) > 2000 then
    raise exception using errcode = 'P0001', message = 'report_details_too_long';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_reported_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'user_unavailable';
  end if;

  if p_context_listing_id is not null and not exists (
    select 1
    from public.listings l
    where l.id = p_context_listing_id
      and l.seller_id = p_reported_user_id
      and l.status in ('active', 'reserved', 'sold')
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_report_context';
  end if;

  select rate.allowed, rate.retry_after_seconds
  into v_allowed, v_retry_after
  from public.consume_action_rate_limit('listing_report', 3600, 10) rate;

  if not coalesce(v_allowed, false) then
    raise exception using
      errcode = 'P0001',
      message = 'report_rate_limited',
      hint = greatest(coalesce(v_retry_after, 60), 1)::text;
  end if;

  insert into public.user_reports (
    reporter_id,
    reported_user_id,
    context_listing_id,
    reason,
    details,
    status,
    moderation_note,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
  )
  values (
    v_reporter_id,
    p_reported_user_id,
    p_context_listing_id,
    p_reason,
    v_details,
    'open',
    null,
    null,
    null,
    now(),
    now()
  )
  on conflict (reporter_id, reported_user_id)
  do update set
    context_listing_id = excluded.context_listing_id,
    reason = excluded.reason,
    details = excluded.details,
    status = 'open',
    moderation_note = null,
    reviewed_by = null,
    reviewed_at = null,
    created_at = now(),
    updated_at = now()
  returning id into v_report_id;

  return v_report_id;
end;
$$;

create or replace function public.set_user_blocked(
  p_blocked_id uuid,
  p_blocked boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocker_id uuid := auth.uid();
begin
  if v_blocker_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if p_blocked_id is null or p_blocked_id = v_blocker_id then
    raise exception using errcode = 'P0001', message = 'invalid_block_target';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_blocked_id
  ) then
    raise exception using errcode = 'P0001', message = 'user_unavailable';
  end if;

  if coalesce(p_blocked, false) then
    insert into public.user_blocks (blocker_id, blocked_id)
    values (v_blocker_id, p_blocked_id)
    on conflict (blocker_id, blocked_id) do nothing;
    return true;
  end if;

  delete from public.user_blocks
  where blocker_id = v_blocker_id
    and blocked_id = p_blocked_id;

  return false;
end;
$$;

create or replace function public.review_moderation_report(
  p_report_kind text,
  p_report_id uuid,
  p_decision text,
  p_moderation_note text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_target_listing_id uuid;
  v_target_user_id uuid;
  v_previous_status text;
  v_next_status text;
  v_note text := btrim(coalesce(p_moderation_note, ''));
  v_audit_action text;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not public.is_current_user_admin() then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;

  if p_report_kind not in ('listing', 'user') then
    raise exception using errcode = 'P0001', message = 'invalid_report_kind';
  end if;

  if p_decision not in (
    'reviewing', 'resolved', 'dismissed', 'hide_listing', 'suspend_user', 'restore_user'
  ) then
    raise exception using errcode = 'P0001', message = 'invalid_moderation_decision';
  end if;

  if char_length(v_note) > 2000 then
    raise exception using errcode = 'P0001', message = 'moderation_note_too_long';
  end if;

  if p_report_kind = 'listing' then
    select r.listing_id, r.seller_id, r.status
    into v_target_listing_id, v_target_user_id, v_previous_status
    from public.listing_reports r
    where r.id = p_report_id
    for update;
  else
    select r.context_listing_id, r.reported_user_id, r.status
    into v_target_listing_id, v_target_user_id, v_previous_status
    from public.user_reports r
    where r.id = p_report_id
    for update;
  end if;

  if not found then
    raise exception using errcode = 'P0001', message = 'report_not_found';
  end if;

  if p_decision in ('reviewing', 'resolved', 'dismissed', 'hide_listing', 'suspend_user')
    and v_previous_status not in ('open', 'reviewing') then
    raise exception using errcode = 'P0001', message = 'invalid_report_transition';
  end if;

  if p_decision = 'hide_listing' and p_report_kind <> 'listing' then
    raise exception using errcode = 'P0001', message = 'invalid_moderation_decision';
  end if;

  v_next_status := case p_decision
    when 'reviewing' then 'reviewing'
    when 'dismissed' then 'dismissed'
    when 'restore_user' then v_previous_status
    else 'resolved'
  end;

  v_audit_action := case p_decision
    when 'reviewing' then 'mark_reviewing'
    when 'resolved' then 'resolve'
    when 'dismissed' then 'dismiss'
    else p_decision
  end;

  if p_report_kind = 'listing' then
    update public.listing_reports
    set
      status = v_next_status,
      moderation_note = nullif(v_note, ''),
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_at = now()
    where id = p_report_id;
  else
    update public.user_reports
    set
      status = v_next_status,
      moderation_note = nullif(v_note, ''),
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_at = now()
    where id = p_report_id;
  end if;

  if p_decision = 'hide_listing' then
    update public.listings
    set status = 'archived', updated_at = now()
    where id = v_target_listing_id
      and status in ('active', 'reserved');
  elsif p_decision = 'suspend_user' then
    update public.profiles
    set is_suspended = true, updated_at = now()
    where id = v_target_user_id;

    update public.listings
    set status = 'archived', updated_at = now()
    where seller_id = v_target_user_id
      and status in ('active', 'reserved');
  elsif p_decision = 'restore_user' then
    update public.profiles
    set is_suspended = false, updated_at = now()
    where id = v_target_user_id;
  end if;

  insert into public.moderation_audit_log (
    actor_id,
    report_kind,
    report_id,
    action,
    target_listing_id,
    target_user_id,
    metadata
  )
  values (
    v_actor_id,
    p_report_kind,
    p_report_id,
    v_audit_action,
    v_target_listing_id,
    v_target_user_id,
    jsonb_build_object(
      'previous_status', v_previous_status,
      'next_status', v_next_status
    )
  );

  return v_next_status;
end;
$$;

-- Browser roles may read only rows allowed by RLS. All writes go through the
-- narrow functions above, preventing owner/seller/status mass assignment.
revoke all on table public.listing_reports from public, anon, authenticated;
revoke all on table public.user_reports from public, anon, authenticated;
revoke all on table public.user_blocks from public, anon, authenticated;
revoke all on table public.moderation_audit_log from public, anon, authenticated;

grant select on table public.listing_reports to authenticated;
grant select on table public.user_reports to authenticated;
grant select on table public.user_blocks to authenticated;
grant select on table public.moderation_audit_log to authenticated;

revoke all on function public.submit_listing_report(uuid, text, text)
  from public, anon;
revoke all on function public.submit_user_report(uuid, text, text, uuid)
  from public, anon;
revoke all on function public.set_user_blocked(uuid, boolean)
  from public, anon;
revoke all on function public.review_moderation_report(text, uuid, text, text)
  from public, anon;

grant execute on function public.submit_listing_report(uuid, text, text)
  to authenticated;
grant execute on function public.submit_user_report(uuid, text, text, uuid)
  to authenticated;
grant execute on function public.set_user_blocked(uuid, boolean)
  to authenticated;
grant execute on function public.review_moderation_report(text, uuid, text, text)
  to authenticated;

create or replace view public.admin_listing_reports
with (security_invoker = true) as
select
  r.id,
  r.listing_id,
  r.reporter_id,
  r.seller_id,
  r.reason,
  r.details,
  r.status,
  r.moderation_note,
  r.reviewed_by,
  r.reviewed_at,
  r.created_at,
  l.slug as listing_slug,
  l.title as listing_title,
  l.status as listing_status,
  l.price,
  l.currency,
  l.cover_image_url,
  reporter.username as reporter_username,
  reporter.full_name as reporter_full_name,
  seller.username as seller_username,
  seller.full_name as seller_full_name,
  seller.is_suspended as seller_is_suspended,
  r.updated_at
from public.listing_reports r
join public.listings l on l.id = r.listing_id
left join public.profiles reporter on reporter.id = r.reporter_id
left join public.profiles seller on seller.id = r.seller_id;

create or replace view public.admin_user_reports
with (security_invoker = true) as
select
  r.id,
  r.reporter_id,
  r.reported_user_id,
  r.context_listing_id,
  r.reason,
  r.details,
  r.status,
  r.moderation_note,
  r.reviewed_by,
  r.reviewed_at,
  r.created_at,
  r.updated_at,
  reporter.username as reporter_username,
  reporter.full_name as reporter_full_name,
  reported.username as reported_username,
  reported.full_name as reported_full_name,
  reported.avatar_url as reported_avatar_url,
  reported.is_suspended as reported_is_suspended,
  context_listing.slug as context_listing_slug,
  context_listing.title as context_listing_title,
  context_listing.status as context_listing_status
from public.user_reports r
left join public.profiles reporter on reporter.id = r.reporter_id
left join public.profiles reported on reported.id = r.reported_user_id
left join public.listings context_listing on context_listing.id = r.context_listing_id;

revoke all on table public.admin_listing_reports from public, anon, authenticated;
revoke all on table public.admin_user_reports from public, anon, authenticated;
grant select on table public.admin_listing_reports to authenticated;
grant select on table public.admin_user_reports to authenticated;
