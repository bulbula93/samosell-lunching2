-- AI Operations foundation, NOT applied to production. Apply only to a designated isolated preview DB.
create table if not exists public.ai_ops_jobs (
 id uuid primary key default gen_random_uuid(),
 idempotency_key text not null unique check (length(idempotency_key) between 1 and 160),
 role text not null check (role in ('coordinator','support','moderation','technical','marketing','seo','finance','seller_success','qa')),
 kind text not null check (kind in ('shadow_moderation','shadow_support','shadow_technical')),
 status text not null default 'queued' check (status in ('queued','leased','awaiting_approval','completed','failed','dead_letter','cancelled')),
 priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
 attempt integer not null default 0 check (attempt >= 0),
 max_attempts integer not null default 3 check (max_attempts between 1 and 10),
 leased_until timestamptz, scheduled_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ai_ops_jobs_claim_idx on public.ai_ops_jobs (status, scheduled_at, priority);
create table if not exists public.ai_ops_activity (
 id uuid primary key default gen_random_uuid(),
 job_id uuid references public.ai_ops_jobs(id) on delete restrict,
 role text not null,
 event_type text not null check (event_type in ('queued','claimed','completed','failed','approval_requested','cancelled','kill_switch')),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 constraint ai_ops_activity_details_size check (pg_column_size(details) < 4096)
);
create index if not exists ai_ops_activity_created_idx on public.ai_ops_activity (created_at desc);
create table if not exists public.ai_ops_approvals (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.ai_ops_jobs(id) on delete restrict,
 action text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
 requested_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '1 day'),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 unique(job_id, action)
);
create table if not exists public.ai_ops_control (
 singleton boolean primary key default true check (singleton),
 stopped boolean not null default true,
 updated_at timestamptz not null default now()
);
insert into public.ai_ops_control (singleton, stopped) values (true, true) on conflict do nothing;
alter table public.ai_ops_jobs enable row level security;
alter table public.ai_ops_activity enable row level security;
alter table public.ai_ops_approvals enable row level security;
alter table public.ai_ops_control enable row level security;
-- Admins can inspect. No authenticated client can mutate these tables.
create policy ai_ops_jobs_admin_read on public.ai_ops_jobs for select to authenticated using (
 exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
);
create policy ai_ops_activity_admin_read on public.ai_ops_activity for select to authenticated using (
 exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
);
create policy ai_ops_approvals_admin_read on public.ai_ops_approvals for select to authenticated using (
 exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
);
create policy ai_ops_control_admin_read on public.ai_ops_control for select to authenticated using (
 exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
);
revoke all on public.ai_ops_jobs, public.ai_ops_activity, public.ai_ops_approvals, public.ai_ops_control from anon;
grant select on public.ai_ops_jobs, public.ai_ops_activity, public.ai_ops_approvals, public.ai_ops_control to authenticated;
revoke insert, update, delete on public.ai_ops_jobs, public.ai_ops_activity, public.ai_ops_approvals, public.ai_ops_control from authenticated;
-- Only the strictly scoped server-side executor (future) may write; service_role bypasses RLS.
