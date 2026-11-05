# Explicit Data API grants — 20 October 2026

## Problem and resulting behavior

Supabase's 30 October change removes automatic grants on future public objects.
Existing tables retain their current permissions. Historical SamoSell SQL relied
on defaults for service-role access at 63 table/view creation sites (47 distinct
relations), and core browser access also relied on defaults.

The affected creators now include explicit service-role table/view grants and
sequence privileges. Core catalog/profile/listing/media/favorite access is
explicit for browser roles. Chat, payments, reports, notifications and AI tables
remain read-only for authenticated clients after the complete ACL replay; writes
continue through existing authorized RPCs/server paths. No new SECURITY DEFINER
functions or broad browser grants were introduced.

These are **historical SQL replay fixes**, not a new incremental migration.
Already-applied migrations are not rerun. Do not replay entire historical files
over a live project merely to add grants. Existing Production objects already
have access and require no October-30 backfill from this change.

Official change:
https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## Live metadata audit

- Production `lxsvjzbiuewgwpajqrwr`: 71 public tables/views; every ordinary table
  had RLS enabled. Existing grants were inspected only.
- QA `ydocqjdjmffysexkzxyc`: 69 public tables/views; every ordinary table had RLS
  enabled. QA includes four AI tables absent from Production, while Production
  has additional liquidity tables and a legacy review view.
- Production still has automatic default grants for postgres-created objects.
  We did not change these settings, secrets, data, migration history or schedules.

## Hosted QA verification

In one transaction on QA, revoked existing grants for the three Data API roles
on the covered objects, replayed **204 actual top-level ACL statements** from
the amended source SQL, and checked **68 tables/views and 9 sequences**.
The remaining QA legacy view is outside these creators.

Assertions passed for service-role SELECT access, absence of guest writes, and
authenticated read-only access to chat, payment, report, notification and AI
objects. Role-switched, zero-row SELECT probes compiled for the public catalog,
messages, chats, boost orders and AI jobs. These are database authorization
probes, not browser or HTTP end-to-end tests.

The transaction ended with ROLLBACK. A second metadata query confirmed that all
QA table/view CRUD grants exactly matched the pre-test snapshot. No persistent
QA schema/data change was made, and no Production SQL mutation was executed.

Security Advisor findings were unchanged before/after: 21 INFO entries for RLS
tables without client policies, 10 anonymous and 56 authenticated SECURITY
DEFINER callable-function warnings, and one disabled leaked-password-protection
warning. The RLS-without-policies tables are internal/RPC-managed in this scope;
the callable-function warnings need a separate per-function review, rather than
blanket revocation that would break the application.

- [RLS advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Anonymous callable-function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated callable-function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Local verification and regression guard

Run `pnpm exec vitest run tests/DataApiGrants.test.ts tests/DataApiCoreDatabase.test.ts`.
The 12 tests exercise:

- actual PostgreSQL ACL replay with no automatic table/sequence grants;
- same-file explicit grants and RLS for public table creators;
- explicit serial/identity sequence access;
- guest/internal-table boundaries and authenticated read-only RPC-managed tables;
- actual core schema creation, public catalog/photos, seller-owned publishing
  and image writes, cross-owner rejection, favorites, profile updates, chat
  participant isolation and a server insert with a generated ID.

The ACL fixture recreates relation and column names, then executes the original
top-level GRANT/REVOKE statements. It is intentionally separate from full schema
replay. The core fixture executes `01_categories.sql` and
`02_marketplace_schema.sql`; only the pgcrypto extension declaration is omitted
because PGlite provides core `gen_random_uuid()` directly.

The full local suite passed: 199 files, 1,124 tests. After the final ownership
and same-file-RLS additions, the targeted suite passed all 12 tests again.
TypeScript and ESLint passed (ESLint has eight existing image warnings).

## Remaining verification boundary

A complete hosted `supabase db reset` was **not** performed. QA is shared with
the AI Operations trial and must not be wiped. The repository also lacks original
CREATE definitions for some legacy objects, including `listing_reviews`,
`seller_trust_summary` and `listing_review_summary`; existing migrations assume
those objects already exist. Consequently, this PR verifies the grant replay
and core schema reset, not a complete fresh Supabase installation or live
signup/payment/browser flow. Reconstructing the legacy baseline is separate work.

Before provisioning a completely new project, reconcile that baseline and run
the full ordered schema history in a disposable environment. Future public
tables must carry their explicit grants/RLS in their creation migration. No new
paid service is needed for the checks included here.
