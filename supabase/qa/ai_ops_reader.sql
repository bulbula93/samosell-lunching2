-- QA ONLY: never place this file in supabase/migrations or run on Production.
-- Provisioning asserts the QA project before sending this SQL.
create role ai_ops_qa_reader nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
alter role ai_ops_qa_reader set default_transaction_read_only = on;
alter role ai_ops_qa_reader set statement_timeout = '5s';
alter role ai_ops_qa_reader set search_path = pg_catalog;
grant connect on database postgres to ai_ops_qa_reader;
grant usage on schema public to ai_ops_qa_reader;
-- Supabase default privileges leave TRUNCATE/REFERENCES/TRIGGER after a DML-only revoke.
revoke all on public.ai_ops_jobs, public.ai_ops_activity, public.ai_ops_approvals, public.ai_ops_control from public, anon, authenticated;
grant select on public.ai_ops_jobs, public.ai_ops_activity, public.ai_ops_approvals, public.ai_ops_control to authenticated;
grant select (id, role, kind, status, priority, attempt, created_at, updated_at) on public.ai_ops_jobs to ai_ops_qa_reader;
grant select (id, role, event_type, created_at) on public.ai_ops_activity to ai_ops_qa_reader;
grant select (id, action, status, requested_at, expires_at) on public.ai_ops_approvals to ai_ops_qa_reader;
grant select (singleton, stopped, updated_at) on public.ai_ops_control to ai_ops_qa_reader;
create policy ai_ops_jobs_qa_reader on public.ai_ops_jobs for select to ai_ops_qa_reader using (true);
create policy ai_ops_activity_qa_reader on public.ai_ops_activity for select to ai_ops_qa_reader using (true);
create policy ai_ops_approvals_qa_reader on public.ai_ops_approvals for select to ai_ops_qa_reader using (true);
create policy ai_ops_control_qa_reader on public.ai_ops_control for select to ai_ops_qa_reader using (true);
-- LOGIN + generated password are provisioned separately; never store credentials here.
