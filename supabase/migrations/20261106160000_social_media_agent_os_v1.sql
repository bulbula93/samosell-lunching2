-- SamoSell Social Media Agent OS v1. Same content as supabase/qa/social_media_agent_os_v1.sql (applied to QA first).
-- Safe defaults: kill switch ON, dry-run, $0 ads, TikTok off, organic auto-publish off.
--
-- Safety invariants enforced by the database itself (not only by application code):
--   * daily Ads budget is 0 and paid-ads permissions are false (CHECK constraints, cannot be updated)
--   * TikTok cannot be enabled
--   * kill switch and dry-run are the defaults
--   * a publish job exists at most once per post/platform/mode; at most one job per post/platform is 'published'
--   * a post can only be queued when it passed QA and has a non-expired human approval for its CURRENT version
--     (or organic auto-publish is explicitly enabled)
--   * any content edit bumps the version, resets QA and expires older approvals
--   * the audit log is append-only
--   * browser clients (anon/authenticated) can only SELECT, and only admins see rows (RLS)

create table if not exists public.social_control (
  singleton boolean primary key default true check (singleton),
  kill_switch boolean not null default true,
  execution_mode text not null default 'dry_run' check (execution_mode in ('dry_run', 'live')),
  instagram_enabled boolean not null default true,
  facebook_enabled boolean not null default true,
  tiktok_enabled boolean not null default false check (tiktok_enabled = false),
  organic_auto_publish boolean not null default false,
  approval_mode text not null default 'paid' check (approval_mode in ('paid')),
  daily_ads_budget_usd numeric(10, 2) not null default 0 check (daily_ads_budget_usd = 0),
  paid_ads_create_allowed boolean not null default false check (paid_ads_create_allowed = false),
  paid_ads_activate_allowed boolean not null default false check (paid_ads_activate_allowed = false),
  paid_ads_spend_modify_allowed boolean not null default false check (paid_ads_spend_modify_allowed = false),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.social_control (singleton) values (true) on conflict do nothing;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (idempotency_key ~ '^[A-Za-z0-9:_./-]{1,160}$'),
  status text not null default 'draft' check (status in (
    'draft', 'qa_failed', 'ready_for_review', 'approved', 'scheduled', 'publishing',
    'published', 'partially_published', 'failed', 'rejected', 'cancelled')),
  pillar text not null check (pillar in ('featured_listing', 'giveaway', 'how_to_sell', 'trust', 'category_roundup')),
  content_type text not null default 'single_image' check (content_type in ('single_image', 'carousel', 'text_link')),
  caption text not null check (char_length(caption) between 1 and 2200),
  hashtags text[] not null default '{}' check (cardinality(hashtags) <= 30),
  media_urls text[] not null default '{}' check (cardinality(media_urls) <= 10),
  link_url text check (link_url is null or link_url ~ '^https://(www\.)?samosell\.ge(/|$)'),
  listing_id uuid,
  platforms text[] not null check (cardinality(platforms) between 1 and 2 and platforms <@ array['instagram', 'facebook']::text[]),
  scheduled_for timestamptz not null,
  version integer not null default 1 check (version >= 1),
  quality_passed boolean not null default false,
  quality_report jsonb not null default '{}'::jsonb check (pg_column_size(quality_report) < 8192),
  created_by_type text not null check (created_by_type in ('agent', 'human')),
  created_by text not null check (char_length(created_by) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_posts_calendar_idx on public.social_posts (scheduled_for, status);

create table if not exists public.social_approvals (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  post_version integer not null,
  action text not null default 'publish_organic' check (action in ('publish_organic')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'consumed')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  decided_by uuid,
  decided_at timestamptz,
  unique (post_id, post_version, action)
);

create table if not exists public.social_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete restrict,
  post_version integer not null,
  platform text not null check (platform in ('instagram', 'facebook')),
  execution_mode text not null check (execution_mode in ('dry_run', 'live')),
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in (
    'queued', 'leased', 'dry_run_completed', 'published', 'failed', 'dead_letter', 'needs_review', 'cancelled')),
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  lease_token uuid,
  leased_until timestamptz,
  scheduled_at timestamptz not null,
  external_container_id text check (external_container_id is null or external_container_id ~ '^[A-Za-z0-9_:-]{1,128}$'),
  external_post_id text check (external_post_id is null or external_post_id ~ '^[A-Za-z0-9_:-]{1,128}$'),
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, platform, execution_mode)
);
create unique index if not exists social_publish_jobs_one_published_idx
  on public.social_publish_jobs (post_id, platform) where status = 'published';
create index if not exists social_publish_jobs_claim_idx on public.social_publish_jobs (status, scheduled_at);

create table if not exists public.social_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_type text not null check (actor_type in ('agent', 'human', 'system')),
  actor text not null check (char_length(actor) between 1 and 80),
  action text not null check (action ~ '^[a-z_]{1,64}$'),
  decision text not null check (decision in ('allow', 'deny', 'dry_run', 'requires_approval', 'success', 'failure')),
  reason text not null check (reason ~ '^[a-z0-9_]{1,64}$'),
  resource_type text not null check (resource_type ~ '^[a-z_]{1,40}$'),
  resource_id text,
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) < 4096)
);
create index if not exists social_audit_log_time_idx on public.social_audit_log (occurred_at desc);

create table if not exists public.social_metrics_daily (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook')),
  metric_date date not null,
  impressions integer not null default 0 check (impressions >= 0),
  reach integer not null default 0 check (reach >= 0),
  likes integer not null default 0 check (likes >= 0),
  comments integer not null default 0 check (comments >= 0),
  shares integer not null default 0 check (shares >= 0),
  saves integer not null default 0 check (saves >= 0),
  link_clicks integer not null default 0 check (link_clicks >= 0),
  synced_at timestamptz not null default now(),
  primary key (post_id, platform, metric_date)
);

-- Ads Planner output. Draft-only: no status can mean "active", and the budget is pinned to zero.
create table if not exists public.social_ad_drafts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  title text not null check (char_length(title) between 1 and 160),
  objective text not null check (objective in ('traffic', 'engagement', 'awareness')),
  audience_notes text not null default '' check (char_length(audience_notes) <= 1000),
  creative_post_id uuid references public.social_posts(id) on delete set null,
  daily_budget_usd numeric(10, 2) not null default 0 check (daily_budget_usd = 0),
  status text not null default 'draft' check (status in ('draft', 'archived')),
  created_at timestamptz not null default now()
);

-- Any change to publishable content creates a new version: QA must re-run and old approvals die.
create or replace function public.social_posts_version_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.caption is distinct from old.caption or new.hashtags is distinct from old.hashtags
     or new.media_urls is distinct from old.media_urls or new.platforms is distinct from old.platforms
     or new.link_url is distinct from old.link_url or new.content_type is distinct from old.content_type then
    if old.status in ('scheduled', 'publishing', 'published', 'partially_published') then
      raise exception 'social_post_locked' using errcode = 'P0001';
    end if;
    new.version := old.version + 1;
    new.quality_passed := false;
    new.quality_report := '{}'::jsonb;
    new.status := 'draft';
    update public.social_approvals set status = 'expired'
     where post_id = old.id and post_version = old.version and status in ('pending', 'approved');
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists social_posts_version_guard on public.social_posts;
create trigger social_posts_version_guard before update on public.social_posts
  for each row execute function public.social_posts_version_guard();

create or replace function public.social_audit_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'social_audit_log_append_only' using errcode = 'P0001';
end $$;
drop trigger if exists social_audit_append_only on public.social_audit_log;
create trigger social_audit_append_only before update or delete on public.social_audit_log
  for each row execute function public.social_audit_append_only();

-- Gate: the database re-checks everything the Policy Gateway checks before any job exists.
create or replace function public.social_enqueue_publish(p_post_id uuid, p_mode text)
returns integer language plpgsql set search_path = '' as $$
declare c record; p record; approval_id uuid; plat text; n integer := 0; inserted uuid;
begin
  if p_mode not in ('dry_run', 'live') then raise exception 'invalid_mode' using errcode = 'P0001'; end if;
  select * into c from public.social_control where singleton for share;
  if not found or c.kill_switch then raise exception 'kill_switch_active' using errcode = 'P0001'; end if;
  if p_mode = 'live' and c.execution_mode <> 'live' then raise exception 'live_mode_disabled' using errcode = 'P0001'; end if;
  select * into p from public.social_posts where id = p_post_id for update;
  if not found then raise exception 'post_not_found' using errcode = 'P0001'; end if;
  if p.status <> 'approved' and not (p.status = 'ready_for_review' and c.organic_auto_publish) then
    raise exception 'post_not_approved' using errcode = 'P0001';
  end if;
  if not p.quality_passed then raise exception 'quality_not_passed' using errcode = 'P0001'; end if;
  if not c.organic_auto_publish then
    select id into approval_id from public.social_approvals
     where post_id = p.id and post_version = p.version and action = 'publish_organic'
       and status = 'approved' and expires_at > now() and decided_by is not null
     for update;
    if approval_id is null then raise exception 'approval_missing' using errcode = 'P0001'; end if;
  end if;
  foreach plat in array p.platforms loop
    if (plat = 'instagram' and not c.instagram_enabled) or (plat = 'facebook' and not c.facebook_enabled) then
      continue;
    end if;
    inserted := null;
    insert into public.social_publish_jobs (post_id, post_version, platform, execution_mode, idempotency_key, scheduled_at)
    values (p.id, p.version, plat, p_mode, 'social:' || p.id || ':v' || p.version || ':' || plat || ':' || p_mode, p.scheduled_for)
    on conflict do nothing returning id into inserted;
    if inserted is not null then n := n + 1; end if;
  end loop;
  if n = 0 and not exists (select 1 from public.social_publish_jobs where post_id = p.id and execution_mode = p_mode) then
    raise exception 'no_enabled_platform' using errcode = 'P0001';
  end if;
  if approval_id is not null then update public.social_approvals set status = 'consumed' where id = approval_id; end if;
  update public.social_posts set status = 'scheduled', updated_at = now() where id = p.id;
  return n;
end $$;

-- Human decision, atomic: approval row and post status change together, bound to the post version.
create or replace function public.social_decide_approval(p_post_id uuid, p_version integer, p_approve boolean, p_user uuid)
returns text language plpgsql set search_path = '' as $$
declare p record; a uuid;
begin
  if p_user is null then raise exception 'decider_required' using errcode = 'P0001'; end if;
  select * into p from public.social_posts where id = p_post_id for update;
  if not found then raise exception 'post_not_found' using errcode = 'P0001'; end if;
  if p.version <> p_version then raise exception 'stale_version' using errcode = 'P0001'; end if;
  if p_approve and (p.status <> 'ready_for_review' or not p.quality_passed) then raise exception 'post_not_reviewable' using errcode = 'P0001'; end if;
  update public.social_approvals set status = 'expired'
   where post_id = p.id and post_version = p.version and status = 'pending' and expires_at <= now();
  update public.social_approvals set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = p_user, decided_at = now()
   where post_id = p.id and post_version = p.version and status = 'pending'
   returning id into a;
  if a is null then raise exception 'approval_not_pending' using errcode = 'P0001'; end if;
  update public.social_posts set status = case when p_approve then 'approved' else 'rejected' end where id = p.id;
  return case when p_approve then 'approved' else 'rejected' end;
end $$;

-- Claim with row locks; SKIP LOCKED means two workers can never lease the same job.
-- Expired leases are NOT retried automatically: the provider call may have succeeded,
-- so the job goes to needs_review instead of risking a duplicate public post.
create or replace function public.social_claim_publish_jobs(p_limit integer, p_lease_seconds integer)
returns table (job_id uuid, lease_token uuid) language plpgsql set search_path = '' as $$
declare c record; j record; t uuid;
begin
  update public.social_publish_jobs set status = 'needs_review', last_error_code = 'lease_expired',
    lease_token = null, leased_until = null, updated_at = clock_timestamp()
   where status = 'leased' and leased_until < clock_timestamp();
  select * into c from public.social_control where singleton for share;
  if not found or c.kill_switch then return; end if;
  for j in
    select id from public.social_publish_jobs
     where status = 'queued' and scheduled_at <= clock_timestamp() and attempt < max_attempts
       and (execution_mode = 'dry_run' or c.execution_mode = 'live')
     order by scheduled_at, id
     for update skip locked
     limit greatest(1, least(p_limit, 5))
  loop
    t := gen_random_uuid();
    update public.social_publish_jobs set status = 'leased', attempt = attempt + 1, lease_token = t,
      leased_until = clock_timestamp() + make_interval(secs => greatest(30, least(p_lease_seconds, 300))),
      updated_at = clock_timestamp()
     where id = j.id;
    job_id := j.id; lease_token := t; return next;
  end loop;
end $$;

create or replace function public.social_record_container(p_job_id uuid, p_token uuid, p_container_id text)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.social_publish_jobs set external_container_id = p_container_id, updated_at = clock_timestamp()
   where id = p_job_id and lease_token = p_token and status = 'leased'
     and (external_container_id is null or external_container_id = p_container_id);
  return found;
end $$;

create or replace function public.social_refresh_post_status(p_post_id uuid)
returns void language plpgsql set search_path = '' as $$
declare total integer; done integer; bad integer;
begin
  select count(*), count(*) filter (where status in ('published', 'dry_run_completed')),
         count(*) filter (where status in ('dead_letter', 'needs_review', 'failed'))
    into total, done, bad from public.social_publish_jobs where post_id = p_post_id;
  update public.social_posts set status = case
      when total > 0 and done = total then 'published'
      when done > 0 and bad > 0 then 'partially_published'
      when bad > 0 and done = 0 then 'failed'
      else 'publishing' end
   where id = p_post_id and status in ('scheduled', 'publishing', 'partially_published', 'failed');
end $$;

create or replace function public.social_complete_publish_job(p_job_id uuid, p_token uuid, p_external_post_id text)
returns boolean language plpgsql set search_path = '' as $$
declare j record;
begin
  update public.social_publish_jobs
     set status = case when execution_mode = 'dry_run' then 'dry_run_completed' else 'published' end,
         external_post_id = p_external_post_id, lease_token = null, leased_until = null,
         last_error_code = null, updated_at = clock_timestamp()
   where id = p_job_id and lease_token = p_token and status = 'leased'
   returning * into j;
  if not found then return false; end if;
  perform public.social_refresh_post_status(j.post_id);
  return true;
end $$;

create or replace function public.social_fail_publish_job(p_job_id uuid, p_token uuid, p_error text, p_retryable boolean)
returns text language plpgsql set search_path = '' as $$
declare j record; next_status text;
begin
  select * into j from public.social_publish_jobs where id = p_job_id and lease_token = p_token and status = 'leased' for update;
  if not found then return 'lease_lost'; end if;
  -- The provider may already have made the post public: a human must check before any resend.
  next_status := case when p_error in ('unknown_outcome', 'container_already_published') then 'needs_review'
                      when p_retryable and j.attempt < j.max_attempts then 'queued' else 'dead_letter' end;
  update public.social_publish_jobs set status = next_status, last_error_code = p_error, lease_token = null, leased_until = null,
    scheduled_at = case when next_status = 'queued'
      then clock_timestamp() + make_interval(secs => 60 * power(4, j.attempt - 1)::integer) else scheduled_at end,
    updated_at = clock_timestamp()
   where id = j.id;
  perform public.social_refresh_post_status(j.post_id);
  return next_status;
end $$;

alter table public.social_control enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_approvals enable row level security;
alter table public.social_publish_jobs enable row level security;
alter table public.social_audit_log enable row level security;
alter table public.social_metrics_daily enable row level security;
alter table public.social_ad_drafts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['social_control', 'social_posts', 'social_approvals', 'social_publish_jobs',
                           'social_audit_log', 'social_metrics_daily', 'social_ad_drafts'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true))', t || '_admin_read', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Explicit server grants (do not rely on Supabase default privileges). No DELETE on audit or control.
grant select, insert, update, delete on public.social_posts, public.social_approvals, public.social_publish_jobs,
  public.social_metrics_daily, public.social_ad_drafts to service_role;
grant select, update on public.social_control to service_role;
grant select, insert on public.social_audit_log to service_role;
-- Supabase default privileges grant ALL to service_role on new tables. TRUNCATE would bypass the
-- append-only trigger, and deleting the control row is pointless; take those away explicitly.
revoke delete, truncate on public.social_audit_log, public.social_control from service_role;
revoke insert on public.social_control from service_role;
revoke update on public.social_audit_log from service_role;
revoke truncate, references, trigger on public.social_posts, public.social_approvals, public.social_publish_jobs,
  public.social_metrics_daily, public.social_ad_drafts from service_role;

-- RPCs: server-only. PUBLIC gets EXECUTE on new functions by default in Postgres; remove it.
revoke all on function public.social_enqueue_publish(uuid, text) from public, anon, authenticated;
revoke all on function public.social_claim_publish_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.social_decide_approval(uuid, integer, boolean, uuid) from public, anon, authenticated;
revoke all on function public.social_record_container(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.social_complete_publish_job(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.social_fail_publish_job(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.social_refresh_post_status(uuid) from public, anon, authenticated;
revoke all on function public.social_posts_version_guard() from public, anon, authenticated;
revoke all on function public.social_audit_append_only() from public, anon, authenticated;
grant execute on function public.social_enqueue_publish(uuid, text) to service_role;
grant execute on function public.social_claim_publish_jobs(integer, integer) to service_role;
grant execute on function public.social_decide_approval(uuid, integer, boolean, uuid) to service_role;
grant execute on function public.social_record_container(uuid, uuid, text) to service_role;
grant execute on function public.social_complete_publish_job(uuid, uuid, text) to service_role;
grant execute on function public.social_fail_publish_job(uuid, uuid, text, boolean) to service_role;
grant execute on function public.social_refresh_post_status(uuid) to service_role;
