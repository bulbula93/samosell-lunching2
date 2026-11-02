# SamoSell CPU experiment - 2026-11-02

## Scope and verified baseline

Production/main: `23fa44a0c11ccdd3cba6b72d318252cd4d93b7fe`, deployment `dpl_2vmJYe2kdydRJYPtEeTkMDJgLBRf`. Verified through Git fetch and Vercel read-only metadata. PR #126 is merged (`4a8b873d1759342a4e9e4cefa2e0c8387abff296`). Open PRs were inspected; security PR #136 remains a separate draft. Its changes are NOT included here. The owner's existing `samosell-local` checkout and untracked `supabase/.temp/` were preserved; implementation uses an isolated clone.

Branch: `preview/cpu-optimization-20261102`. No Production deploy, merge, schema/data/env mutation, firewall/scheduler change or paid capability. The 11:36 Tbilisi CPU snapshot in the task is historical; no fresh 30-day CPU allocation or billed savings are claimed.

Read `AGENTS.md` and installed Next 16.2.3 documentation: unstable_cache, revalidateTag and incremental-static-regeneration. The online latest docs are newer; installed docs and actual production-build manifests are the version-specific evidence. Cache Components migration is deliberately outside this experiment.

## Stage 1 - TTL

| Home render dependency | Before | After | Verification |
| --- | ---: | ---: | --- |
| app/page.tsx route | 60 s | 300 s | `.next/prerender-manifest.json` effective initialRevalidateSeconds |
| public home data | 60 s | 300 s | anonymous unstable_cache; cache key v7 |
| home ad rows | 60 s | 300 s | separate home-only wrapper, active-ads tag |
| other ad placements | 60 s | 60 s | unchanged wrapper |
| navigation | 600 s | 600 s | existing public cache |
| footer / metadata | no fetch | no fetch | static render tree |
| personalization / Stories | private client load | unchanged | not a dependency of ISR HTML |

The isolated TTL candidate is commit `1e98d11`; baseline is `23fa44a`. Both builds have the expected effective TTL (60/300), not merely changed source constants. Later promotion improvements retain the same 300 s dependency floor, verified again in the final local build.

The same 20-row deterministic local fixture and two HTML requests at t=0,65,130,195,260,325 seconds were used. No external database, browser scripts/images or Demo Data. Real elapsed time, no virtual clock. Initial cache ages differ because builds ran sequentially; **exclude t=0** from the matched comparison below. Raw data retains it.

| Matched t=65..325, 10 requests each | Before | After |
| --- | ---: | ---: |
| local ISR STALE triggers with HIT follow-up | 5 | 1 |
| local HTML HIT responses | 5/10 | 9/10 |
| upstream reads during samples | 10 | 2 |
| Node process CPU, total | 985 ms | 781 ms |
| Node process CPU / sampled HTTP request | 98.5 ms | 78.1 ms |
| HTTP errors | 0 | 0 |
| Vercel origin invocations / billed Active CPU | not measured | not measured |

CPU uses IPC `process.cpuUsage()` from the Next server process. Samples include background regeneration and exclude fixture/client CPU. They include JIT/GC, have no repeated-run statistics and do not estimate Vercel billed CPU. Requests were sparse and timed to TTL boundaries, not representative of actual traffic. Five-to-one regeneration frequency is consistent with TTL arithmetic under sustained demand; it is not a guarantee of overall CPU savings or free-quota compliance.

Home catalog failures still throw within regeneration; home ad failures now also propagate instead of successfully caching an empty ad state. Next retains the last successful page on time-based regeneration failures. Existing promotion deadline clocks, live listing price/status/visibility and seller suspension/username checks remain. Home ad candidates now include already-known future schedules; SSR uses an explicit render timestamp, then the browser starts/ends them at their deadlines with one timer and no polling. End boundaries are exclusive. Unknown new campaigns still require successful mutation invalidation or TTL refresh.

**Freshness limit:** ISR is stale-while-revalidate, not a hard 300-second maximum age. No-JS HTML and the pre-hydration frame can contain an expired paid placement or older price/status; existing deadline guards correct hydrated UI, and listing detail/authorization remain live. Out-of-band SQL/Storage changes do not invoke app invalidation. These limits require release acceptance; do not claim real-time homepage visibility.

## Stage 2 - invalidation

Public metadata/images/related queries have listing ID/slug, seller ID and category tags rather than relying solely on two shared purge tags. Bulk fallback tags remain on readers for unknown-scope moderation and reconciliation. Wrapper construction does not keep an unbounded process-local cache registry; Next owns persistent cache keys and arguments.

| Caller / mutation | Final behavior |
| --- | --- |
| dashboard/listings/actions status update and delete | listing + slug + seller, category scope, common feeds; immediately after confirmed success, before optional notifications/storage cleanup |
| dashboard/listings/form-actions create/edit | listing, current/previous slug, seller, old/new gender categories and overlapping taxonomy routes; after saved rows/images, before optional work |
| dashboard/profile refresh | authenticated, rate-limited seller scope; own embedded name/avatar/store data, all shared feeds |
| admin/actions listing hide/restore | listing ID, common feeds, category fallback; unknown seller bundles expire safely |
| admin/actions user suspend/restore/verify | seller ID and shared feeds; live visibility checks retained |
| admin/categories/actions | broad fallback + existing marketplace-navigation tag; taxonomy changes can affect every public representation |
| moderation block/unblock | private path refresh only; no anonymous-data purge |
| moderation report review | broad immediate fallback; RPC can affect an unknown listing or user |
| dashboard/boosts pending order creation | no public tag purge: no placement has changed |
| dashboard/boosts admin review | order's listing/seller scope; activation helper also invalidates after successful activation |
| dashboard/boosts manual TBC status refresh | redundant purge removed; verified sync owns actual-change invalidation |
| boost-reconciliation activation/per-listing reconcile | listing scope; unknown seller fallback |
| boost-reconciliation expired batch | broad fallback only when count > 0; scheduler untouched |
| flitt-boost finalize/reversal | listing scope only on activated/changed result; provider/attribution logic unchanged |
| tbc-sync | verified applied-change condition unchanged; returned listing/seller IDs if available, safe broad fallback otherwise |
| dashboard/chats commerce | creating/rejecting offers no longer purges public data; accept/reserve/release/sale retain broad safety fallback because RPC payload does not identify all affected resources |
| dashboard/orders transition | returned listing slug, or broad fallback if missing |
| reviews save | known listing scope + seller-bundle fallback; seller page path refresh retained |
| flitt-ad activate/reverse/expire | existing changed-only active-ads + home path invalidation |
| admin/ads mutations | existing active-ads + relevant page refresh after successful writes |

Every helper caller and direct revalidateTag call is captured in `cpu-invalidation-inventory-20261102.txt`. Related per-page revalidatePath calls remain; no claim that all route regeneration was removed.

A listing category move invalidates both old/new gender routes. Footwear, bags, vintage, accessories and perfume use overlapping keyword/taxonomy rules; all five expire together until an authoritative mapping is available. Unknown/legacy gender expires all categories. This is a deliberate correctness fallback, not a claim of perfectly minimal category invalidation. Seller profile changes invalidate category feeds because rows embed seller data. SEO pagination counts now carry the same feed/category/bulk tags, so count/indexability does not stay stale after app mutations.

Behavioral simulation: warm A and B, mutate A, reread both. Broad baseline needs 4 upstream reads total; scoped implementation needs 3 and retains B. This is a mocked Next cache model, not a billed CPU measurement. Real database mutation handlers are also exercised by existing PGlite idempotency and action regression suites.

## Stage 3 - bounded browse and analytics

Catalog SSR and metadata/canonical/robots/pagination remain server-rendered. Only unfiltered browse for 9 category choices, first 3 pages and 2 existing sort choices is cached: **54 maximum keys**, 30 seconds. Arbitrary search/filter combinations bypass the new cache and retain existing ranking/experiments. Public queries use a stateless anonymous client; no cookies, authorization results, favorites, blocks, unread counts or admin flags enter the shared value. Private favorites and header identity remain request-specific. A/B behavior test shares exactly one public read while retaining separate favorite IDs and header users. Listing/seller live visibility checks and Proxy remain intact.

| Matched local browse | Before | After |
| --- | ---: | ---: |
| /catalog first request: upstream reads | 4 | 4 |
| /catalog/women first request: upstream reads | 1 | 1 |
| /catalog warm 10 requests: upstream reads | 10 | 0 |
| /catalog/women warm 10 requests: upstream reads | 10 | 0 |
| /catalog warm CPU/request | 82.8 ms | 81.3 ms |
| /catalog/women warm CPU/request | 76.6 ms | 59.4 ms |
| local origin HTML requests per warm route | 10 | 10 |
| HTTP / upstream errors in final matched series | 0 | 0 |

The warm result is a narrow fixture sample within 30 seconds, without private session costs or hydration. It removes one public listing query per repeated browse request; it does not remove dynamic origin rendering. Existing facets/navigation/ads caches are not counted as newly implemented optimizations. A preliminary fixture omitted the facets read RPC and produced optional 405s; it was corrected to serve that read-only RPC, and **only the clean rerun is retained here**. CPU figures are noisy and must not be extrapolated to billing.

Analytics route checks denied consent, bots, event/context validity and event IDs before initializing authenticated Supabase. Withdrawal remains a separate authenticated/anonymous consent path. Browser deduplication stores at most 128 successful event IDs for 120 seconds, scoped by session; failed requests remain retryable, new identify IDs are never suppressed. Effect dependencies use consent primitives rather than object identity. No batching was added: it would require a larger server/idempotency change without measured need. Database event_id idempotency, sale/conversion attribution and Meta delivery are retained and tested; no global analytics shutdown. Preview-only external writes/delivery are disabled intentionally.

## Validation and reproducibility

Local Node is 24.14.1; repository/CI/Vercel use Node 22 (Vercel respects package engines even though project setting says 24). This difference limits local CPU comparison portability. Lockfile unchanged.

- Initial full local suite: 1,172 passed / 5 failed (1,177 tests, 205 files). Failures were two incomplete revalidateTag mocks, two old TTL/key assertions and the temporary bootstrap Vercel config assertion. Each was corrected; affected suites passed on targeted reruns. The initial full run is not described as green.
- TypeScript, lint and fixture production build are run again as needed after substantive edits. Full repository lint has 8 existing image warnings and no intended rule disablement.
- Added behavior covers A/B isolation, finite browse keys, failure not cached as empty, scoped invalidation, category moves/fallback, post-save invalidation before optional notification failure, scheduled promotion start/expiry, cheap analytics gates, bounded acknowledged-event dedup/retry and QA build target guards. Existing database idempotency/attribution tests remain.
- Required GitHub CI runs the full suite, TypeScript, lint and a local-fixture build on the Draft PR. Final check links and exact results belong to the PR/final delivery report.
- Reproduce TTL: create sibling `baseline` and `ttl-candidate` clones at the two SHAs above; run `node scripts/benchmark-cpu-ttl.mjs` from an installed candidate checkout, with `CPU_BENCH_WORK_DIR` pointing to their parent. Logs/results are written under that scratch directory; elapsed sampling takes 325 seconds after both builds.
- Reproduce browse: fixture-build baseline/candidate, then `node scripts/benchmark-cpu-browse.mjs --baseline <baseline> --output <scratch>/browse-results.json`. It refuses builds without a localhost fixture URL.

## Preview boundary and release gate

34 branch-only Preview overrides were created and read back: QA project `ydocqjdjmffysexkzxyc`, its publishable key, read-only transport, no privileged database key, no outbound provider credentials and disabled Preview payment/Meta/growth writes. Canonical remains `https://samosell.ge`, matching Production SEO intent. No Production secret was copied. The new prebuild guard rejects a wrong database target or privileged credentials on this branch before Next prerendering. Existing Vercel SSO protection remains enabled.

Bootstrap: Vercel required the remote branch to exist before accepting scoped env. An exact-branch source deployment=false override did not prevent the initial push build. Deployment `dpl_nnHFpLoLq9txyqaGkcHGSekjFRXc` was canceled during compilation, before logged page-data/prerender phases. No request was sent to its Preview. That override is reverted in the final source. Do not infer absence of all remote reads from build logs alone.

**NOT READY for Production until release gates are accepted:** source-matched READY QA Preview + CI, low-volume protected-page smoke, and explicit acceptance of stale-while-revalidate/no-JS promotion limits. QA Preview is intentionally read-only; real two-account authenticated mutation/OAuth/payment/Meta delivery acceptance is not claimed. No 30-day causal CPU allocation or live billing improvement is established. Separate security draft #136 remains outside this change.

## Conditional rollout (requires separate Production authorization)

1. Confirm main/Production has not moved, CI is green, review this diff and complete QA mutation/visibility acceptance with two ordinary accounts in an isolated writable QA configuration. Verify new/edit/delete, category move, active/reserved/sold, hide/restore, seller rename/avatar/suspension, promotion activate/cancel/expire and optional analytics consent/idempotency/attribution.
2. Capture a fresh, comparable baseline: invocation count and Active CPU by route, cache hit/regeneration reasons, ISR writes, upstream errors/timeouts and request mix. Keep billed CPU, Node CPU, wall time, ISR writes and CDN counts separate.
3. Release TTL change first, with confirmed promotion/freshness acceptance. Observe 24 hours under comparable traffic; then scoped invalidation, then bounded browse/analytics in separate reviewed releases. Do not add paid monitoring or change cron/firewall settings.
4. Stop on private-data leakage, hidden/deleted item visibility beyond expected invalidation, incorrect price/status on authoritative detail/actions, promotion expiry failure, analytics attribution loss or elevated errors. Revalidate affected public tags immediately for a visibility incident; retain live authorization.
5. If healthy, compare 24/48-hour route-normalized Active CPU and upstream workload with the new baseline. No quota guarantee.

## Rollback (requires Production authorization)

Before release, retain the current known-good deployment `dpl_2vmJYe2kdydRJYPtEeTkMDJgLBRf` and source SHA above (refresh if main moves). Restore the known-good Production deployment using Vercel rollback/promote under explicit authorization, then revert the optimization commits on main through a reviewed PR to prevent the next Git deployment restoring them. Confirm a current home/catalog/listing/seller page, live visibility/price/status and personal isolation; invalidate public data for privacy/visibility incidents. There are no schema migrations or data backfills to roll back. Reverting only TTL must restore home route, public data and home ad wrapper together to 60 seconds.
