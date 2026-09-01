# Phase 14 — Production Hardening, Regression Audit, and Launch Readiness

Audit date: 2026-09-01  
Production URL: https://samosell.ge  
Audited baseline: `origin/main@bc12569155e0b13054a1449517b24a55734df535`  
Working branch: `phase14-production-hardening`

## Scope and evidence policy

This report separates observed production defects from expected authorization failures and harmless warnings. A finding is closed only when the relevant code, automated checks, and available production evidence agree. No production data is modified by this audit unless a later entry explicitly records an approved, non-destructive migration.

## Step 1 — Baseline

### Repository inspection

- Stack: Next.js 16.2.3 App Router, React 19.2.4, TypeScript, pnpm 10.17.1, Supabase SSR/client 2.112.0 from the lockfile.
- Declared runtime: Node.js 22.x. The audit host currently runs Node.js 24.14.1.
- Routes: 40 application routes, including public catalog/listing/seller routes, protected dashboard routes, admin routes, auth callback, TBC return/callback routes, PWA manifest, robots, and sitemap.
- Mutations/API surface: 19 server-action/API files.
- Database history: 42 local Supabase migrations.
- Edge Functions: one `push-dispatch` function. `supabase/functions` is excluded from the Next.js TypeScript project.
- Production deployment: Vercel deployment `dpl_6M2vsH2okGqBRTQey9qKSPFMfdXj` is `READY` at commit `bc12569155e0b13054a1449517b24a55734df535`.

### Commands and exact results

| Command | Result | Evidence / warning |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Lockfile unchanged; 451 packages installed. Warning: repository requires Node 22.x but host is Node 24.14.1. pnpm reported ignored install scripts for `sharp` and `unrs-resolver`. |
| `pnpm run build` | FAIL (environment) | Compilation and TypeScript passed; page-data collection failed because the isolated audit worktree intentionally had no `NEXT_PUBLIC_SUPABASE_URL`. This is not classified as a product defect. |
| `pnpm run build` with process-only placeholder public Supabase URL/key and production site URL | PASS | Next.js compiled, TypeScript completed, 27 static pages generated, build traces collected, and all 40 routes were emitted. No secrets were written to disk. |
| `pnpm exec tsc --noEmit` | FAIL | `tests/MarketplaceHeader.test.tsx` contains three stale user-state fixtures missing required `unreadNotifications`. |
| `pnpm run lint` | FAIL | Four errors: synchronous state updates in effects in `CatalogFilterFields.tsx` and `PushPwaSettings.tsx`; impure `Date.now()` render calls in `AdminReviewCard.tsx` and `AdminUserReviewCard.tsx`. |
| `pnpm run test` | FAIL | 41 files passed, 7 failed; 250 tests passed, 11 failed; one unhandled rejection. Failures are concentrated in stale Phase 12/13 expectations/mocks plus one null-unsafe search-parameter access exposed by a test. Each failure is being reviewed before classification or repair. |

### Baseline warnings and suspected blockers

| ID | Severity | Component | Evidence | Initial classification | Status |
| --- | --- | --- | --- | --- | --- |
| P14-001 | P1 High | Quality gate | TypeScript, lint, and tests fail on the exact production commit. | Confirmed launch-quality blocker; determine test-only versus runtime causes before changes. | Open |
| P14-002 | P2 Medium | Local/CI parity | Audit host runs Node 24.14.1 while `package.json` requires Node 22.x. | Operational warning; final gate must run with Node 22 if available. | Open |
| P14-003 | P2 Medium | Repository workflow | Existing local `main` was ahead by 1 and behind `origin/main` by 129 commits, with unrelated uncommitted files. Audit therefore uses an isolated worktree at the exact production commit. | Operational risk; user work remains untouched. | Mitigated |
| P14-004 | P2 Medium | Environment setup | An env-less local production build fails during static page collection. | Expected local environment constraint; verify deployment env separately. | Open |
| P14-005 | P2 Medium | Listings runtime | Vercel 7-day history contains 11 `listings.is_promoted does not exist` failures on older deployments; none appeared in the latest 24 hours. | Historical production defect; verify current schema and current code before closing. | Investigating |
| P14-006 | P2 Medium | Homepage runtime | One `home_data_failed: canceling statement due to statement timeout` event occurred in the 7-day window; none appeared in the latest 24 hours. | Intermittent production defect; inspect query plan/index/advisors. | Investigating |

## 1. Confirmed production blockers

Pending audit.

## 2. Security findings

Pending audit.

## 3. Functional regressions

Pending audit.

## 4. Operational warnings

Pending audit.

## 5. Non-blocking improvements

Pending audit.

## 6. Verification results

Pending final quality gate.

## 7. Remaining manual tests

Pending audit.
