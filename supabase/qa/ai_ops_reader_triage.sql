-- QA ONLY: apply only to project ydocqjdjmffysexkzxyc, never Production.
-- Existing jobs expose no customer payloads. Triage needs the last state change
-- to avoid calling an old, recently updated job stale. No write privileges.
grant select (updated_at) on public.ai_ops_jobs to ai_ops_qa_reader;
