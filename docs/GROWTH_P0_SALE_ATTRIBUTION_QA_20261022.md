# Growth P0 sale attribution QA — 2026-10-22

Branch: `preview/growth-p0-20261022` · PR: #130

## Verdict: NOT READY — authenticated browser E2E remains open

Preview: https://samosell-lunching2-git-prev-3132e4-giorgibulbula-6265s-projects.vercel.app

The database and automated component/action checks pass. This is not a claim that the complete deployed UI journey passed. The cloud browser reaches the QA login page; a signed-in QA seller and buyer session must be supplied securely to finish listing creation, messaging, selling and review-request UI checks. The 390px and 1440px browser runs have not been completed.

## Findings and corrections

1. The original READY deployment inherited the production Supabase URL from generic Preview variables. It had no branch-specific Supabase configuration. No test mutations were attempted against it. Added overrides scoped exclusively to this Preview branch for the QA URL and QA publishable key, and blanked the inherited privileged service-role key. Production variables were not modified.
2. Disabled payment checkout flags and outbound Resend email on this QA branch. No production secrets were read or changed.
3. CI run 39750617098 failed six assertions across three test files: the old hero copy/VIP placeholder expectations and pre-attribution action payload expectations. Updated those expectations to the intended product behavior; added eight behavioral cases for source selection, missing buyers, external sales, candidate loading failure, reopening and stale retries. No existing tests were removed or skipped.

## Verification

| Check | Result | Evidence / scope |
| --- | --- | --- |
| QA migration | PASS | `20261022085227 growth_p0_track_sale_source` is applied; live trigger definition checked |
| TypeScript | PASS | `node node_modules/typescript/bin/tsc --noEmit` |
| ESLint | PASS | 0 errors, 8 existing `no-img-element` warnings |
| Full Vitest suite | PASS | 198 files, 1125 tests passed |
| Targeted component/action tests | PASS | 29 tests passed |
| Next.js production build | PASS | `node scripts/build-with-public-fixture.mjs`, exit 0; public data fixture avoids live DB access |
| Reviews / Chat / Listing regression | PASS (automated) | Existing suites included in full Vitest run |
| External sale through deployed UI | BLOCKED | QA seller login required |
| Buyer message → SamoSell sale → review request through UI | BLOCKED | QA seller and buyer logins required |
| 390px / 1440px browser verification | NOT RUN | Required before READY |

## Live QA database checks

`scripts/qa-sale-attribution.sql` executed against **ydocqjdjmffysexkzxyc only**. Fixtures are created within one transaction and rolled back. Writes run under `authenticated` with explicit actor claims; catalog visibility runs under `anon`. These are database integration tests, not browser E2E tests.

| Test | Result |
| --- | --- |
| SamoSell without buyer blocked | PASS |
| External with buyer blocked | PASS |
| External status/source/null buyer persisted | PASS |
| No external review-request notification | PASS |
| Sold listing hidden from anonymous catalog via RLS | PASS |
| Non-owner cannot change listing status | PASS |
| SamoSell status/source/verified buyer persisted | PASS |
| Exactly one buyer review request after repeat update | PASS |
| Outsider rejected by real review RPC | PASS |
| External-sale review rejected by real review RPC | PASS |
| Verified buyer accepted by real review RPC | PASS |
| Reopening clears source and buyer for both sale types | PASS |

Post-rollback verification: **0 test users, 0 test listings, 0 test notifications** remain. No storage objects were created. Existing QA accounts/data were not removed.

## Release boundary

PR remains unmerged. No Production deployment, Production data write, Production secret change, or Production schema migration was performed. Production migration requires a separately authorized release. Custom brand creation and other service-role-only capabilities are intentionally unavailable on this isolated QA branch until a QA-specific server credential is configured; ordinary existing-brand listing and sale actions use the authenticated QA client.
