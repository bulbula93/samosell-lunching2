# SamoSell AI Operations — Foundation v0

## Status
Architecture baseline and read-only admin preview only. **No agent execution, scheduling, API keys, automation, mutations or database migrations in this PR.**

## Existing integrations
Next.js 16 app router, Supabase SSR, admin authentication in `requireAdminUser`, GitHub/Vercel, moderation reports, support tickets, VIP/Flitt signals. Reuse these sources behind narrowly scoped server tools; never give the model direct service-role database access.

## Design
- Orchestrator dispatches typed jobs to role-specific workers. AI proposes actions; deterministic policy checks authorize actual execution.
- Supabase tables to add in a later, isolated migration: `ai_agent_runs`, `ai_jobs`, `ai_action_proposals`, `ai_approvals`, `ai_audit_events`. Include idempotency keys, retry counts, lease and heartbeat, tenant scope, redacted payloads, timestamps and RLS.
- Outbox/queue worker must enforce at-least-once delivery with idempotent effects, bounded retry, dead-letter queue, concurrency limits and kill switch.
- Credentials stay in server-side secret manager. No user tokens, passwords, payment details or raw support conversations in model logs.
- Human approvals must be authenticated, action-specific, expiring, single-use and validated server-side against current resource state. Never accept a model-produced `approvedByHuman` flag as proof.
- Tool calls must log actor, run ID, input digest, resource scope, policy decision, outcome and timing. Use retention and redaction policies.
- Production write and deploy privileges are **out of scope** until separate security review and explicit release approval.
- `authorizeAgentAction` models intended policy but is not yet an execution gateway. No privileged action may depend on this helper alone.

## Rollout
1. Foundation Preview: admin-only UI, role catalog, deny-by-default policy and unit tests (this PR).
2. Add database schema and read-only observability tools in separate preview-safe migration; use a separate test project or fixtures and never write production data during QA.
3. Run monitor/support/moderation in shadow mode with evaluation datasets; measure false positives and costs.
4. Add server-side executor, robust approval verification, incident escalation, emergency stop and bounded spend.
5. Enable controlled, narrowly scoped production automation only after documented approval.

## Definition of done (this PR)
- `/admin/ai` uses existing admin authentication.
- No job runner, cron or OpenAI call, no new required environment variables.
- Role/action rules have unit tests.
- Existing production branch, Supabase schema and payments remain untouched.
- CI and Vercel Preview checks must pass before considering next step.
