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
- Database history at the final audit revision: 47 local Supabase migrations; production reports 49 applied entries because two earlier production entries use generated apply timestamps.
- Edge Functions: one `push-dispatch` function. `supabase/functions` is excluded from the Next.js TypeScript project.
- Baseline production deployment: Vercel deployment `dpl_6M2vsH2okGqBRTQey9qKSPFMfdXj` was `READY` at commit `bc12569155e0b13054a1449517b24a55734df535`.
- Phase 14 production deployment: `dpl_9mFHcKysSmdh3P8DQWBkc8UabYMM` is `READY`, aliases `samosell.ge`, and was built from exact commit `a5266690fb3252fbf3235d4a3cb9ec5b32218630`.

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
| P14-001 | P1 High | Quality gate | TypeScript, lint, and tests fail on the exact production commit. | Confirmed launch-quality blocker; determine test-only versus runtime causes before changes. | Closed |
| P14-002 | P3 Low | Local/CI parity | Audit host runs Node 24.14.1 while `package.json` requires Node 22.x. | Vercel used Node 22.x and completed the production build. | Closed |
| P14-003 | P2 Medium | Repository workflow | Existing local `main` was ahead by 1 and behind `origin/main` by 129 commits, with unrelated uncommitted files. Audit therefore uses an isolated worktree at the exact production commit. | Operational risk; user work remains untouched. | Mitigated |
| P14-004 | P3 Low | Environment setup | An env-less local production build fails during static page collection. | Expected local environment constraint; production build uses Vercel-managed env. | Mitigated |
| P14-005 | P2 Medium | Listings runtime | Vercel 7-day history contains 11 `listings.is_promoted does not exist` failures on older deployments; none appeared in the latest 24 hours. | Historical production defect; current schema and deployment include the field. | Closed |
| P14-006 | P2 Medium | Homepage runtime | One `home_data_failed: canceling statement due to statement timeout` event occurred in the 7-day window; none appeared in the latest 24 hours. | Intermittent production warning; monitor after deployment. | Open |

## 1. Confirmed production blockers

No P0 blocker was found. The following launch blockers were confirmed and closed:

| ID | Severity | Component | Evidence and reproduction | Root cause | Fix | Verification | Commit | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P14-007 | P1 High | Seller verification | The owner UPDATE policy allowed a signed-in user to PATCH their own `profiles.is_seller_verified` value directly through the Data API. Production had 0 verified profiles at audit time, so no existing escalation was found. | The profile privilege trigger preserved `is_admin` and `is_suspended`, but not `is_seller_verified`. | A DB trigger now forces the flag off on untrusted insert and preserves the old value on untrusted update. Trusted service/admin paths remain available. | Migration applied to production; function body checks passed; 8 targeted tests passed. | `e7effec` | Closed |
| P14-008 | P1 High | Listing mutation boundary | An owner could bypass the server form and directly mutate counters, send unsupported status transitions, or save malformed public listing values through the Data API. | Ownership RLS prevented IDOR but did not provide field-level integrity or transition enforcement. | A DB trigger preserves immutable counters/timestamps, enforces the existing status graph, derives publication time, and adds non-destructive constraints. One legacy short description remains under a `NOT VALID` constraint; all new writes are checked. | Migration applied; constraints and trigger inspected in production; 26 targeted tests passed. | `96c4b23` | Closed |
| P14-009 | P1 High | Listing deletion | The hard-delete action removed storage objects before deleting the owned DB row. A failed DB delete could leave a live listing with missing images. | Non-atomic cleanup order favored storage deletion. | The owned DB row is now deleted first. Storage cleanup is best-effort afterward and cannot damage a retained listing. Destructive requests are limited to 6/hour/user. | Production rate-limit migration applied; 10 targeted tests passed; lint/typecheck passed. | `99a912c` | Closed |
| P14-001 | P1 High | Quality gate | Baseline typecheck, lint and test suite failed. | Stale Phase 12/13 fixtures plus four React stability lint violations and one null-unsafe `useSearchParams` test/runtime boundary. | Updated assertions/mocks to current security behavior, made search attribution null-safe, remounted controlled catalog filter state from URL values, deferred browser capability synchronization, and passed a stable moderation reference time. | TypeScript PASS; ESLint PASS; 53 files / 274 tests PASS; production build PASS locally. | `021bc08`, `b1b3123`, `30a26ec` | Closed |

## 2. Security findings

| ID | Severity | Component | Evidence and reproduction | Root cause | Fix / disposition | Verification | Commit | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P14-010 | P2 Medium | Ranking abuse | Production exposed `increment_listing_views(uuid)` to `anon` and `authenticated`; any caller could repeatedly inflate an active listing's ranking signal. Current application code has no caller. | Legacy SECURITY DEFINER grant remained public. | Revoked browser-role execution; retained service-role execution only. | Production privilege query: anon=false, authenticated=false, service=true; 14 targeted tests passed. | `5480831` | Closed |
| P14-011 | P2 Medium | Web Push | Authenticated clients could churn subscription writes without a rate limit and could submit obvious local/IP-literal HTTPS endpoints. | Phase 13 route enforced auth, origin, count and key lengths but had no central write throttle or basic SSRF guard. | Added the exact `push_subscription` rule (30/10 min), enforced it on POST/DELETE, and rejected credentials, localhost/local names and IP literals while preserving real push provider domains. | Migration applied; anon cannot execute limiter; 7 targeted push tests passed. | `2e0b3bb` | Closed |
| P14-012 | P2 Medium | TBC callback | Malformed or oversized callback bodies were unbounded and internal exception messages were returned in a public 500 response. | Callback parsed the whole body and serialized `error.message`. | Added 16 KiB body limit, strict payment-id shape, 413/400 responses and a generic 500 body; details remain server-log only. Payment verification/amount semantics are unchanged. | 20 payment/boost tests passed; typecheck passed. | `cae9e4c` | Closed |
| P14-013 | P2 Medium | Anonymous search analytics | `record_search_impression` and `record_search_interaction` are intentionally anonymous SECURITY DEFINER RPCs and can write analytics rows. Inputs/counts are bounded and event keys are idempotent, but there is no trustworthy anonymous per-client rate limit at the database boundary. | Public search attribution includes signed-out traffic. | No risky architectural change was made. Add an edge/firewall rate limit or a signed server ingestion token before high-volume marketing traffic. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). | Function bodies, grants and table grants inspected; no private-table read path found. | — | Open |
| P14-014 | P3 Low | Public profile API surface | `profiles` is publicly readable and includes public storefront contact fields plus internal booleans such as admin/suspension state. Auth emails are not stored there; listing and seller UI deliberately exposes seller phone/contact fields. | Public seller profiles use the base table rather than a narrow public view. | No launch-blocking private data leak was confirmed. A narrow public seller view is recommended to reduce future accidental exposure. | Public selectors and profile schema reviewed. | — | Open |

RLS review result: listings, images, favorites, chats, messages, notifications, saved searches, orders, offers, reports, moderation tables and boost/payment tables have RLS. Ownership/participant queries are scoped server-side and mutation RPCs independently check `auth.uid()`. Push/search-internal tables with “RLS enabled, no policy” have browser grants revoked and service-role-only table grants; they are intentional deny-by-default tables, not missing-access defects. Authenticated SECURITY DEFINER RPCs were checked for their internal owner/participant/admin validation. Legacy admin search RPCs are revoked; current admin search RPCs are service-role-only and receive an actor already verified by the server action.

## 3. Functional regressions

| ID | Severity | Component | Evidence | Fix / disposition | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P14-015 | P2 Medium | Header accessibility | Notification center and chat icon shared the same accessible name, producing three indistinguishable “შეტყობინებები” links in the header test. | Bell is now “ნოტიფიკაციები”; chat is now “ჩათები”. Visual layout is unchanged. | Header tests, lint and browser console check passed. | Closed |
| P14-016 | P2 Medium | Search attribution | `useSearchParams()` could be null in compatibility/test contexts and caused a render exception. | Added null-safe lookup without changing URL attribution behavior. | Chat and search analytics regression tests passed. | Closed |
| P14-005 | P2 Medium | Historical listing schema mismatch | 11 `listings.is_promoted does not exist` errors appeared on old deployments in the 7-day Vercel window. | Current deployment and current Supabase view/query both include the field; no occurrence in the latest 24 hours. | Closed as historical/stale deployment evidence; monitor after Phase 14 deploy. | Closed |

Auth/session review: password/Google login routes, callback exchange, logout, refresh proxy, dashboard/admin layouts and safe `next` parsing were inspected. Protected pages call `getUser()` server-side; admin pages additionally query `is_admin`. The return-path helper accepts only single-leading-slash internal paths. Google OAuth initiation currently reaches Google's identifier page rather than the former deleted-client error. Full credential-based login/logout remains manual.

Chat/notification review: chat start/send RPCs enforce participant ownership, status, blocks, length, request UUID and rate limit. Messages are idempotent by sender/client request ID. Notifications use `chat_message:<message id>` unique event keys; “new buyer” email/push occurs only for the first buyer message. Push delivery has notification/subscription uniqueness, retry states, invalid subscription cleanup, a private dispatch secret and server/Edge-only service/VAPID secrets.

Commerce review: offers/orders use participant-scoped SECURITY DEFINER RPCs, row locks, explicit status graphs, stale-offer resolution and `chat_commerce` rate limits. TBC order amount/currency come from the server-selected product and successful provider details are compared in minor-unit-equivalent rounded values before activation. Replay calls are reconciled idempotently. No client-supplied price activates a boost.

## 4. Operational warnings

| ID | Severity | Component | Evidence | Recommendation | Status |
| --- | --- | --- | --- | --- | --- |
| P14-006 | P2 Medium | Homepage database latency | One statement timeout occurred in the 7-day window; no repeat in the latest 24 hours. Existing listing filter/order index was confirmed. | Monitor after deployment; capture `EXPLAIN (ANALYZE, BUFFERS)` only if it repeats. Avoid speculative index churn. | Open |
| P14-017 | P2 Medium | Supabase Auth | Leaked-password protection is disabled in the security advisor. | Enable it in Supabase Auth settings after confirming UX/support implications. | Open |
| P14-018 | P3 Low | Supabase performance advisors | 83 notices: 14 unindexed foreign keys, 25 auth RLS init-plan notices, 35 unused indexes and 9 multiple-permissive-policy notices. None is direct proof of a current production failure. | Address from measured slow queries, starting with frequently written foreign keys and duplicate profile SELECT policy; do not delete indexes blindly. | Open |
| P14-002 | P3 Low | Local runtime parity | Local host is Node 24.14.1; repository/Vercel require Node 22.x. | Vercel build logs confirm Node 22.x was selected from `package.json`; production parity gate passed. | Closed |
| P14-004 | P3 Low | Local environment | A bare isolated worktree has no production env and cannot collect pages. | Expected. Local build was rerun with process-only placeholder public values; production verification must use Vercel-managed env. | Mitigated |

Production logs classification before fixes:

- Category A defects: old `is_promoted` schema mismatch and one homepage timeout; no current 24-hour recurrence.
- Category B expected authorization: no repeated application-bug 4xx cluster; one Edge Function GET returned expected 405 while dispatch POST returned 200.
- Category C harmless: normal 200/206/303/304/307 traffic and successful auth/API/cron entries.
- No production 5xx, unhandled promise rejection, missing-env exception or failed push-dispatch execution was present in the latest 24-hour sample.

## 5. Non-blocking improvements

- Add edge-level abuse controls for anonymous search analytics and expensive public ranked-search RPCs.
- Replace the public base `profiles` read surface with a purpose-built seller-public view.
- Consolidate duplicate public profile SELECT policies after query-plan measurement.
- Add a CI job that runs install, lint, typecheck, tests and build under Node 22 with required build-time public env stubs.
- Add scheduled smoke tests for homepage/catalog/listing latency and TBC callback generic-error behavior.

## 6. Verification results

### Automated/local

| Command | Exact result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS; lockfile unchanged; Node 22 engine warning on Node 24; ignored `sharp`/`unrs-resolver` install scripts warning. |
| `pnpm exec tsc --noEmit --pretty false` | PASS, exit 0. |
| `pnpm run lint` | PASS, exit 0, zero ESLint findings. |
| `pnpm test` | PASS: 53 test files, 274 tests. |
| `pnpm run build` with process-only placeholder public build env | PASS: Next.js 16.2.3 compiled, TypeScript passed, 27 static pages generated, 40 application routes emitted. |
| Targeted profile privilege tests | PASS: 2 files, 8 tests. |
| Targeted listing integrity/form tests | PASS: 3 files, 26 tests. |
| Targeted TBC callback/boost tests | PASS: 3 files, 20 tests. |
| Targeted push tests | PASS: 2 files, 7 tests. |
| Targeted deletion tests | PASS: 2 files, 10 tests. |
| Targeted view-counter/discovery/search tests | PASS: 3 files, 14 tests. |

### Production database

- Five non-destructive migrations were applied. No row was deleted or rewritten by the migrations.
- Seller verification and listing integrity triggers/constraints are active.
- `push_subscription` limiter: authenticated execute=true, anon=false.
- `increment_listing_views`: anon=false, authenticated=false, service-role=true.
- Post-change Supabase advisors still report the documented intentional service tables, public search functions and performance notices; no new missing-RLS/table-grant regression was introduced.
- Final advisor counts: security 45 (9 INFO, 36 WARN) and performance 83 (49 INFO, 34 WARN). The security set consists of 9 intentional deny-by-default RLS tables, 6 reviewed anonymous functions, 29 reviewed authenticated functions, and the one open leaked-password warning. No new critical advisor appeared.

### Production deployment and runtime

- Git push advanced `origin/main` from `bc12569` to `a526669`; the remote had not moved during the audit, so no concurrent commit was overwritten.
- Vercel cloned exact commit `a526669`, used Node 22.x, ran `pnpm install --frozen-lockfile`, compiled Next.js 16.2.3, completed TypeScript, and finished the deployment successfully.
- Deployment `dpl_9mFHcKysSmdh3P8DQWBkc8UabYMM` reached `READY` with `samosell.ge` attached and no alias error.
- The first 30-minute deployment window had no grouped runtime errors and no warning/error logs; the observed requests were HTTP 200.
- Vercel server-side live fetch returned HTTP 200 for home, catalog, manifest, service worker, robots, sitemap, protected-route responses, and missing-listing output. Protected/admin output contains login/private-safe handling; admin and missing-listing output carry `noindex`.
- Current Supabase API samples returned 200, Auth samples showed normal completed requests, and the latest `push-dispatch` Edge execution was POST 200.
- A direct post-deploy desktop-browser replay could not be completed because this audit host began returning `ERR_CONNECTION_RESET` for `samosell.ge`; Vercel's independent live fetch and runtime telemetry remained healthy. This environment failure is not presented as a passed browser test.

### PWA/SEO/static review

- Manifest, service worker, robots and sitemap returned HTTP 200 with expected content types before deployment.
- Service worker caches only same-origin `/_next/static/` and four static icons; it does not cache dashboard pages, authenticated responses or APIs.
- Notification click paths are constrained to leading-slash same-origin paths.
- `robots.txt` disallows `/admin`, `/dashboard`, `/test-db` and `/test-marketplace`; dashboard/admin/test layouts/pages use `noindex` metadata and server authorization.
- Public home/catalog/listing/seller pages have canonical/OpenGraph metadata. Missing/private listings invoke Next `notFound` and emit noindex metadata; streamed HTML can still carry HTTP 200, recorded as a framework/SEO warning rather than an authorization leak.

### Changed files

`app/admin/reports/page.tsx`, `app/api/push/subscription/route.ts`, `app/api/tbc/checkout/callback/route.ts`, `app/dashboard/listings/actions.ts`, `components/layout/MarketplaceHeader.tsx`, `components/listings/CatalogFilterFields.tsx`, `components/listings/CatalogLandingFilters.tsx`, `components/listings/MobileFiltersDrawer.tsx`, `components/moderation/AdminReviewCard.tsx`, `components/moderation/AdminUserReviewCard.tsx`, `components/pwa/PushPwaSettings.tsx`, `components/search/SearchAttributionInput.tsx`, `lib/rate-limit.ts`, `tests/ChatMigration.test.ts`, `tests/HomePageContent.test.tsx`, `tests/MarketplaceHeader.test.tsx`, `tests/MyListingsActions.test.ts`, `tests/MyListingsUi.test.tsx`, `tests/SearchAnalyticsPhase10.test.ts`, `tests/SearchQualityPhase11A.test.ts`.

Created: this report; five migrations (`20260901081619`, `20260901082327`, `20260901090000`, `20260901091000`, `20260901092000`); and seven targeted security tests (`ProfilePrivilegeMigration`, `ListingOwnerIntegrityMigration`, `PushSubscriptionHardening`, `ListingDeleteHardening`, `ListingViewCounterSecurity`, `TbcCallbackHardening`, plus updated existing regression coverage).

## 7. Remaining manual tests

- Credential-based email/password login, logout and stale/deleted-session recovery with dedicated QA accounts.
- Complete Google consent/callback flow (initiation is verified; credentials/consent were intentionally not automated).
- Two-account chat/offer/order test covering buyer and seller authorization after deploy.
- Real TBC sandbox/low-value checkout, callback, replay and return-route test; no production payment was initiated during this audit.
- Real push enable/disable after the new rate-limit route is deployed; Phase 13 end-to-end delivery was previously confirmed and was not destructively repeated.
- Non-admin `/admin` browser attempt with a dedicated account; server-side code/RPC denial and forged private-resource 404 were verified.
- Mobile device install/navigation smoke on iOS and Android after deployment.
- Repeat post-deploy visual checks at 360, 390, 768, 1280 and 1440 px and re-check the browser console once the audit host's direct network path stops resetting connections. Pre-deployment desktop checks were clean, but the production revision was not visually re-certified after deploy.
- Send malformed and over-16-KiB callback requests to the production TBC callback from an approved QA network to confirm live 400/413 bodies. Automated boundary tests passed; the audit host's direct TLS path reset before these safe live probes completed.

## Final launch gate

- Production build: PASS.
- Automated tests: PASS (53 files, 274 tests).
- Security blockers remaining: 0.
- P0 remaining: 0.
- P1 remaining: 0.
- P2 remaining: 3 (`P14-006`, `P14-013`, `P14-017`).
- P3 remaining: 2 (`P14-014`, `P14-018`).
- Recommendation: **GO WITH KNOWN ISSUES**. There is no confirmed critical/high blocker, but anonymous analytics abuse controls, leaked-password protection and the one-off homepage timeout should be addressed or actively monitored.
