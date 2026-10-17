# AI Operations Foundation v0.5

Scope: PR #121, `preview/ai-agents-foundation-20261017`. Never merge or promote without the owner's approval.

## Connection and trust boundary

The existing application Auth and `requireAdminUser()` remain unchanged. Every QA snapshot checks the authenticated user and their current `profiles.is_admin` before creating a database connection. Redirects escape the reader. No new API endpoint or Server Action exposes data.

The separate `ai_ops_qa_reader` database login connects exclusively to SamoSell-QA (`ydocqjdjmffysexkzxyc`). It has no role memberships, BYPASSRLS, superuser, role creation, replication, or database creation privileges. Column-level SELECT grants cover only the four AI Operations metadata tables. Activity details, reviewer identity, Auth, customer profiles, listings, and financial tables are inaccessible. There is no Service Role Key.

`supabase/qa/ai_ops_reader.sql` is QA-only provisioning, outside the shared migration directory. It was applied once to QA, following an audit confirming that the foundation tables already existed. Credentials are provisioned separately using a generated password and SCRAM verifier; neither belongs in git. Existing authenticated AI table grants were reduced to SELECT, including removal of leftover TRUNCATE, REFERENCES and TRIGGER privileges. RLS remains enabled; admin SELECT policies remain intact, with SELECT policies added only for the dedicated reader.

The server validates the exact QA URL, pooler hostname/port, database name, role and project-ref username. Connection URL query parameters and alternate hosts/roles are rejected. `VERCEL_ENV`, `VERCEL_TARGET_ENV`, and the exact branch guard prevent production/custom-environment use. Fixed SQL runs in a repeatable-read read-only transaction over verified TLS with bounded connection/query timeouts. Each request closes its connection. Driver error messages and credentials are never logged or rendered.

## Vercel configuration

Only this Preview branch receives:

- `AI_OPS_QA_URL`: QA API origin, used as an exact project assertion
- `AI_OPS_QA_DATABASE_URL`: Secret, scoped Postgres reader credential (replaces the proposed `AI_OPS_QA_READ_KEY`)
- `AI_OPS_KILL_SWITCH=true`: explicit server stop

No `NEXT_PUBLIC_` variable contains the QA credential. Existing public Supabase/Auth configuration is not repointed to QA. The legacy `AI_OPS_SHADOW_ENABLED` flag no longer triggers customer or payment queries from the Shadow page.

The branch-specific prebuild smoke check establishes a real TLS connection from Vercel, checks role/session identity, deny-write privileges, private-column denial, no elevated memberships or executable user-defined SECURITY DEFINER functions, and requires the database stop row to be true. It executes only reads, with no fixture records. Other environments skip the check.

## Panel behavior

`/admin/ai/activity` shows bounded recent jobs (20), activity (30), and approval requests (20, pending first), plus exact total and pending counts. Times use Asia/Tbilisi. Activity outcome is derived from the stored event type; no free-text details payload is read. Approval risk is derived from the checked-in action policy and unknown actions are high-risk. Every approval requires a human; there are no mutation buttons.

`/admin/ai/shadow` reads the same QA snapshot. It no longer scans production customer/support/payment tables. `/admin/ai` links to both panels and explains that all workers are inactive.

Missing configuration/schema, denied access, missing control rows, and connection failures show a sanitized unavailable state. They never appear as fake zero counts or sample activity. Effective stop is on whenever configuration is unavailable, the server stop defaults to on, or the QA control row says stopped. The database stop value and server stop are displayed separately. A false stop value does not imply an active worker.

## Validation and remaining gate

Unit/integration tests cover the actual admin helper with mocked Auth transport, unauthorized and non-admin access to all three pages, strict environment/URL isolation, redacted errors, read-only transactions, repeated reads, database RLS/ACLs, and database idempotency uniqueness. PGlite security tests use session authorization to reproduce the reader's inability to escalate.

Live admin browser verification is a separate release gate: mock transport tests and infrastructure smoke do not substitute for signing in and observing the deployed panel. Keep the PR draft until all results and that verification are recorded.

## Before 24/7 Shadow Workers

Implement an atomic database enqueue/claim RPC with idempotency, `FOR UPDATE SKIP LOCKED`, bounded leases, retries, recovery and dead-letter handling; enforce stop state in every claim and execution. Add a separate least-privileged worker identity (never reuse the reader), a scheduler with environment/branch restrictions, redacted inputs and outputs, model budget/time limits, audited approval enforcement tied to exact action parameters, and worker observability/alerts. Configure model credentials via secure server variables. Start with QA-only read/draft tasks and require a separate decision before any production access or writes. Current job state helpers are pure helpers, not an atomic worker implementation.
