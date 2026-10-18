# AI Operations final QA — 2026-10-18

Status: **NOT READY** until all required evidence below is complete. No merge or production release authorized.

## Scope and observed baseline

- PR #125, branch `preview/ai-agents-foundation-20261017`, baseline `c970fc714d77d697dcde713ecfbfe8ecc82f03d2`.
- GitHub CI #609: TypeScript, lint, tests, build successful (workflow 39119560975).
- Baseline Vercel deployment `dpl_5RaZXuuHcQ3fqjPFc66NGfCSzsBJ`: READY, same commit.
- Real Cloud Browser admin authentication succeeded. Opened `/admin/ai`, `/admin/ai/activity`, `/admin/ai/shadow`, `/admin/system`; tested overview → shadow and activity → overview navigation.
- Desktop viewport: 1363 × 936. System document width 1348; no page-level horizontal overflow observed. Georgian text readable; queue keeps full UUIDs in a local horizontal-scroll region.
- Browser console scan: extension metadata errors from `chrome-extension://` only; no application runtime error observed during the tested navigation. This is a bounded scan, not proof that every runtime path is error-free.

## Confirmed defects and corrections

1. Activity triage merged the web environment kill switch with the external QA database stop flag. Browser showed an active worker and completed cycles beside `STOPPED · 1`. Triage now uses DB control, matching the status panel.
2. Triage did not receive `updated_at`; an old but recently updated active job could be incorrectly called stale. Reader and adapter now pass last state-change time. Added **only SELECT(updated_at)** to the existing QA reader; no write privilege added.
3. A reader connection failure asserted that the system was stopped, although an external worker could continue. The panel now shows unknown worker/kill-switch state and explains the limited observation.
4. Overview asserted the schedule was disabled. Text now points to current DB control and last execution, distinguishing autonomous AI agents from the deterministic technical worker.
5. Sample text did not accurately describe pending-first approval ordering. It now shows actual sample sizes, maximum limits, ordering and the 24-hour stale definition.
6. Unknown approval states were ignored. `UNKNOWN_STATE` now covers both job and approval statuses.

## Live QA comparison (read-only)

At 2026-10-18 10:45 UTC the browser showed jobs **57**, activity **172**, pending **0**, last tick **10:45 UTC / 14:45 Tbilisi**, `completed`. SQL separately confirmed all 57 jobs completed, DB stop false, worker and scheduler true. The original triage STOPPED finding was therefore false.

At 10:51:20 UTC SQL showed jobs **58**, activity **175**, pending **0**, sample size **20**, dead-letter **0**, stale **0**, unknown **0**. The extra job and three events were produced by the existing scheduled QA run; last tick 10:50 UTC, `completed`. Schedule `*/5 * * * *` remained active. No control flags, schedules, test users or listings were changed.

The live sample contains healthy completed jobs and no approvals. Error findings are exercised using isolated unit fixtures; no incident was injected into the running QA trial.

## Security evidence

- Every reader call authorizes through `requireAdminUser()` before opening the connection; admin layout, overview and system page also guard access.
- Exact Preview environment, branch, QA project, pooler host, role, port and database allowlist retained. Production and other branches fail closed; no fallback to the application's auth database or service key.
- Reader uses verified TLS, fixed SQL and a REPEATABLE READ / READ ONLY transaction, bounds metadata to 20 jobs, 30 events and 20 approvals, redacts driver errors and closes connections.
- Live catalog inspection: reader has no INSERT/UPDATE/DELETE/TRUNCATE, no superuser/bypass-RLS/create-role/create-DB privileges or role memberships; no profiles/details access; no executable non-system SECURITY DEFINER functions. RLS enabled on all four AI Ops tables.
- Live authenticated role without an admin identity saw 0 rows in all four AI Ops tables in a rolled-back read-only transaction. No user or claim was created.
- Direct `SET LOCAL ROLE ai_ops_qa_reader` simulation was denied by the management connection. Actual reader connectivity/privileges are instead verified by Vercel's build smoke and authenticated browser reads; denial was not bypassed.
- Pure triage has no network, model-provider, scheduler or mutation dependencies. No production agent executor is wired to these modules.
- No production code, schema, business records or control settings changed during this work. Existing application authentication and `/admin/system` health reads use the application's configured backend; operational QA reads use only SamoSell-QA.
- New SQL is kept under `supabase/qa/`, outside automatic production migrations. `ai_ops_reader_triage.sql` was applied only to QA.

## Regression results for these changes

Node 22 / pnpm 10.17.1, unchanged lockfile and dependency versions:

- `pnpm exec tsc --noEmit`: PASS.
- `pnpm lint`: PASS, no lint findings.
- `pnpm test`: PASS, **187 files / 1,058 tests**.
- `pnpm build`: PASS, Next.js 16.2.3 webpack build, 51 static pages generated. Local build uses the repository CI's placeholder configuration, with payments disabled/test-only; no live QA or production credentials are loaded locally.
- Regression coverage includes all six finding codes, exact approval expiry and stale boundaries, recent updates to old jobs, terminal states, DB-vs-environment kill switches, unknown reader state, metadata privileges and admin denials.
- The initial local attempt used the runtime's incompatible pnpm 11 and stopped at dependency setup. It was replaced by the repository's Node 22 / pnpm 10.17.1 toolchain; no application restriction was disabled and no package/dependency files were changed.

## Remaining gate evidence

- New Vercel Preview verification and final commit/deployment evidence are recorded in PR #125's current description after this commit deploys.
- Exact 390px and 768px Cloud Browser visual tests are not yet completed. The exposed Cloud Browser API has no viewport/emulation control; desktop inspection is not a substitute.
- No live signed-in non-admin account browser test was performed; authorization tests and live RLS checks cover the boundary independently.
- Connection-error and empty/error finding UI states are tested with fixtures, not induced by disrupting QA.

## Release constraints

Keep PR #125 in draft until the readiness gate is complete. The QA reader intentionally remains unavailable on production deployments; use the existing protected QA Preview link from the admin navigation. Releasing this PR does not activate agents, a scheduler or production monitoring data access.

No paid provider, subscription or monitoring service added. Existing GitHub/Vercel/Supabase resource limits still apply. No merge or production deployment performed.
