# AI Ops queue rollout — Preview only

This change supplies durable schema and a **read-only UI**, not a running 24/7 worker.

- Migration file: `supabase/migrations/20261017170000_ai_ops_foundation.sql`.
- Do not apply on Supabase production project `lxsvjzbiuewgwpajqrwr` or connect Preview with production service-role credentials.
- Before applying, explicitly select and verify a separate isolated Preview Supabase project. Until then, the UI reports schema unavailable.
- Persistent queue has unique idempotency keys, status constraints, attempts, scheduling timestamps, leases, indices and append-only audit log design.
- Tables have admin-only select via RLS and no browser-side writes. Kill switch defaults to stopped = true.
- Future worker must atomically claim jobs (prefer SQL RPC with locked rows), compare-and-set state transitions, use a scoped executor credential, redact PII, limit retries, enforce idempotent effects, validate one-time human approvals, log results and stop on kill switch. No such worker is installed yet.
- Add integration tests on isolated DB for concurrent claim, duplicate job insertion, approval replay, expired lease, admin RLS and non-admin access before enabling execution.
- Review and verify preview Build, TypeScript, lint, unit tests. Production/main merge remains blocked.
