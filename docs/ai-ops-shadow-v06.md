# QA Shadow Worker & Scheduler v0.6

Scope: `preview/ai-agents-foundation-20261017`, PR #121, SamoSell-QA `ydocqjdjmffysexkzxyc` only. No production changes or merge. This extends the v0.5 reader; its worker/stop descriptions below supersede the historical v0.5 rollout text.

## What runs

The first worker is a deterministic SQL queue-health observer. It counts queued/dead-letter/expired jobs in the QA AI Operations queue and stores a small structured observation in Activity Log. It does **not** use an LLM, send messages, read customer/support/payment tables, change users or financial data, or approve/execute business actions. No provider credentials, API endpoints, or extra database login secrets were added.

This established Next.js/Postgres stack is retained. `ai_ops_private.run_shadow_tick()` is the bounded execution entry point. The QA pg_cron job `samosell-ai-shadow-qa-v06` is configured every five minutes, installed **inactive**. Worker and scheduler controls default to false; database stop remains true. The Preview panel remains read-only.

## Queue correctness

- Identity sequence orders audit events correctly even within one transaction; event timestamps use the wall clock.
- One observation per five-minute time bucket, protected by the existing unique idempotency key.
- Transaction advisory lock prevents overlapping scheduler ticks.
- Atomic `FOR UPDATE SKIP LOCKED` claim with incremented attempt, random lease token, and 60-second expiry.
- Completion/failure requires the current token and an unexpired lease; stale or repeated completion is rejected.
- Retry backoff is capped at 300 seconds, with the existing maximum-attempt budget (three for scheduled observations).
- Expired leases recover in bounded batches of 20; exhausted attempts enter dead-letter status. Recovery and failure log only enum error codes.
- Tick processes at most five jobs. Each claim/completion/recovery checks the stop state and worker permission. Missing control/scope denies execution.
- Stop checks take a shared control-row lock: stop updates serialize after any already-running short transaction, and block subsequent work. Cron commands set statement timeout to five seconds and lock timeout to two seconds. No external actions occur inside that transaction.

## Permissions

Two NOLOGIN roles are used. `ai_ops_shadow_engine` owns the private functions and has only the necessary AI queue/activity permissions plus control status updates. It cannot change stop/enable flags, read profiles or financial/customer tables, create roles/databases, replicate, or bypass RLS. `ai_ops_shadow_caller` can only execute the single no-argument tick entry point; it cannot call claim/finish helpers or access tables directly. Cron drops to this caller before invoking the entry point.

Only the entry point is SECURITY DEFINER, owned by the constrained engine (not postgres). It is in a non-exposed private schema with a fixed `pg_catalog` search path and no dynamic SQL. PUBLIC, anon, authenticated, service_role, and the reader cannot execute it. Helper functions are SECURITY INVOKER. RLS remains enabled on the public tables.

The existing `ai_ops_qa_reader` remains read-only and gains SELECT only on the four new control status fields. No UI mutation API or button is added.

## Stop authority and activation

The **database** `ai_ops_control.stopped` is authoritative for this database-resident worker. Both `worker_enabled` and `scheduler_enabled` must also be true, and the cron job must be active for recurring execution. The panel now presents those database controls separately. The historical Vercel `AI_OPS_KILL_SWITCH` flag is not a stop control for pg_cron; it neither activates nor disables this SQL worker. It is retained for compatibility with a future server worker adapter.

Activation is a separate deliberate operation: review the exact scope above, verify Preview, then update the three database controls and activate only the named QA cron job in one transaction. Emergency stop is `stopped=true`; disable the named cron job as well to stop future invocations. There is no production scheduler, no Vercel production cron, and no automatic activation on deployment.

## Verification evidence

- PGlite regression tests exercise stop/enable gates, idempotency, stale tokens, duplicate completion, expired leases, backoff, dead-letter, bounded ticks, redacted errors, RLS and privilege escalation.
- Two concurrent real QA transactions competed for one disposable job: exactly one claimed it, the other received no job. The disposable job and its activity were cleaned up.
- Two real QA verification cycles each completed with `enqueued=1`, `completed=1`, `failed=0`. Their queued/claimed/completed activity remains as truthful execution records; it contains only QA queue counters.
- Stop and enable flags were restored to their defaults, and the recurring schedule remains inactive.
- A separate one-second verification schedule invokes the stopped worker to verify pg_cron execution; the disposable schedule is removed after checking its run history.

Before adding an LLM/customer-facing agent, add validated redacted inputs, model/tool budgets, outcome evaluation, exact-parameter approval enforcement, and a separate least-privileged source reader. Do not treat this metadata monitor as a deployed support/moderation AI agent.
