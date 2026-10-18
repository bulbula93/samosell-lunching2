# SamoSell Vercel CPU audit — 18 October 2026

## Follow-up — 19 October, Asia/Tbilisi

The existing optimization PR #126 had not reached Production. Its branch has now
been integrated locally with current `main` commit
`d64f55f402a2f847ddacd74a33e13b9c1967e273`; Git merged the changes cleanly.
The AI triage release on main is preserved. No Production release is included.

Fresh Production runtime logs for 18 October 21:16–21:46 UTC confirm continued
background homepage retry work on deployment `dpl_5SiXfPW4Yx9ZwJzmrmGc9Ce9o4Pr`:

- At 21:40:37 UTC, two `catalog_pool` log entries reported 40,763ms and 41,191ms
  elapsed against a displayed 15,000ms budget, followed by `home_public_data_retry`
  after an `AbortError`.
- At 21:46:04 UTC, retry timeout entries reported 327,005ms and 327,008ms elapsed,
  with `home_public_data_unavailable` and background revalidation errors.
- These are elapsed timers, not Active CPU measurements. They do not establish
  a 327-second CPU loop or attribute all monthly consumption to the homepage.

A new read-only `pg_stat_statements` sample found the home-shaped projection at
1,896 calls, mean 27.94ms and maximum 1,028.43ms. The five catalog query shapes
with the highest accumulated SQL execution time had means between 3.02ms and
27.94ms, and maxima no higher than 1,397.21ms. These aggregate samples cannot rule
out unsampled HTTP/RLS/network delays, but do not account for the long elapsed
timers. No database mutation was performed.

Two additional amplification defects were found in the unmerged patch and fixed:

1. `settleHomeQuery` turns a rejected transport into null. A fast rejected
   `AbortError` previously qualified for a fresh fallback request. Rejected
   transports now terminate the attempt, and only an explicit HTTP 5xx response
   may retry within the remaining original budget. Missing/zero status, 4xx,
   cancellation and deadline failures do not retry.
2. A request microtask could start after execution resumed beyond its deadline,
   before the delayed timer callback ran. The deadline is now checked before
   starting upstream work as well as after receiving a response. A standalone
   reproduction advanced wall time by 327 seconds: before the fix it launched
   one upstream request; after the fix it launched zero and rejected with the
   expected timeout.

Seven additional functional regression cases cover rejected transports,
non-retryable/missing status and expired-start behavior. The five focused CPU,
deadline, coalescing, Proxy and seller-preview suites pass all 35 tests. Current
full-suite, build, CI and Preview results are recorded in the updated PR #126.
The existing branch-scoped read-only flag and public backend configuration were
checked before publishing; Production configuration and payment jobs are unchanged.

The old observations below remain historical evidence. In particular, PR #125 is
now merged on main, and the former final Preview/CI SHA is not the follow-up SHA.
No matched live before/after CPU percentage or quota reset is claimed.

Release gate: **NOT READY for Production.** Code checks pass, but a representative before/after Vercel CPU comparison, complete authenticated browser flows and 30-day route attribution are unavailable. The alert has not been declared resolved. Preview outcome and browser verification are recorded in the PR description after deployment.

Baseline: `main` / `364a00ae1aa757dbdde7363f0e7779433be3f390`, Production deployment `dpl_EzJ6njP9Ybizz3L9cYEuXxdgLjNo`. Work branch: `preview/vercel-cpu-emergency-optimization-20261018`. No Production schema/data, environment, billing, cron or hosting changes were made. No load/stress tests or paid model requests were run.

## Observed quota and CPU ownership

Source: signed-in Vercel Team Usage dashboard, Last 30 Days, observed around 19:20–19:22 Asia/Tbilisi. The dashboard rendered the range “Sep 18, 9:00 - Oct 18, 9:00”. These are rolling dashboard snapshots, not an invoice or a guarantee of reset time.

| Metric | Observed |
|---|---:|
| Team plan | Hobby |
| Fluid Active CPU | 4h 1m / 4h |
| SamoSell Active CPU | 4h 55s, displayed 100.0% of team usage |
| chimi-rukis-gadmowera Active CPU | 4s |
| live-blackjack-platform-api Active CPU | 0s, rounded |
| Team function invocations | 341,725 / 1,000,000 |
| Fluid provisioned memory | 61.4 GB-hrs / 360 GB-hrs |
| Non-Fluid function duration | 0 GB-hrs; not Fluid wall-clock duration |
| CDN requests | about 281K |
| Edge middleware invocations | 0; this does not exclude Node Proxy execution |
| Vercel Cron invocations | 0; external schedulers still invoke endpoints |
| Build time | 25h / 100h |
| Build CPU time | 62h 52m; separate from Fluid CPU |
| Sandbox CPU | 1h 36m; separate from Fluid CPU |

The quota exhaustion is confirmed and attributable almost entirely to SamoSell. Rounded team totals imply approximately 42ms of CPU per invocation on average over this window; that arithmetic is not a per-function profile. Four included CPU-hours can be exhausted by ordinary request volume without a runaway CPU loop.

The legacy Observability schema API returned 404. The dashboard provides real CPU figures but limits Hobby route history to 12 hours. 24 hours requires Pro; longer history requires Observability Plus. Neither was enabled. The runtime-log API rejected a 1-hour window at its retention boundary; a bounded 30-minute query succeeded. **The exact routes and triggers responsible for all 30 days of CPU cannot be reconstructed from this evidence.**

## Top 10 Production CPU routes available in the dashboard

Source: Functions → Production → Last 12 hours, snapshot approximately 07:23–19:23 Asia/Tbilisi. Sorted by displayed aggregate Active CPU. Units below are total CPU for each displayed route, not query latency. The dashboard rounded some figures. Duration cells were locked; detailed Duration/TTFB charts explicitly showed “Demo Data” and were excluded.

| Route | Invocations | Active CPU | HTTP error rate |
|---|---:|---:|---:|
| `/listing/[slug]` | 487 | 25s | 0% |
| `/` | 63 | 18s | 0% |
| `/catalog/[category]` | 461 | 18s | 0% |
| `/seller/[username]` | 197 | 13s | 0% |
| `/catalog` | 142 | 7s | 0% |
| `/api/internal/tbc/reconcile` | 149 | 6s | 0% |
| `/api/home-personalization` | 37 | 4.85s | 0% |
| `/api/growth/events` | 47 | 4.58s | 0% |
| `/login` | 131 | 4.42s | 0% |
| `/api/web-vitals` | 41 | 2.26s | 0% |

Production overview: approximately 2.4K invocations, Active CPU average 111ms, P75 181ms, P95 221–222ms, HTTP error 0%, platform timeout 0%. Per-route and overview aggregates are dashboard outputs and must not be assumed to have identical aggregation semantics.

A separate Preview snapshot around 07:28–19:28 showed approximately 1.1K invocations, average CPU 34ms, P75 28ms, HTTP error 2.5%, platform timeout 0%. Top Preview routes included `/` (18 invocations / 4.45s), `/admin/ai/activity` (24 / 2.95s), categories (159 / 2.12s), listings (77 / 1.89s), and `/admin/ai/shadow` (20 / 790ms). These rolling snapshots differ by several minutes and should not be summed into an exact comparison.

## Confirmed defects versus hypotheses

Confirmed from code and regression reproduction:

1. The common query timeout only sent an AbortSignal. A transport ignoring cancellation could keep its caller pending. A late response could be accepted before a delayed timer callback ran.
2. Homepage fallback used a fresh 6-second request budget after a 15-second attempt; its outer timing logger still reported 15 seconds. Timeout/cancellation failures could launch another upstream read.
3. Concurrent public cache misses had no application-level in-flight coalescing or failure cooldown.
4. Proxy constructed a Supabase SDK before deciding a guest page/API request needed no auth work. Listing existence checks had no deadline.
5. Product/seller card links and footer links allowed automatic speculative navigation. They could execute server work without a user opening a destination.
6. Cached homepage promotion booleans lacked per-render expiry checks.
7. Browser verification found the seller page throwing `SELLER_TRUST_STATS_FAILED` in read-only Preview: its public count RPC used POST and was correctly blocked by the write guard. The live SQL definition is STABLE and only returns aggregate counts. A real-SDK regression reproduced the failure before the fix; Production mode already passed.

Confirmed live observations:

- The 14:51:03–15:21:03 UTC runtime snapshot contained 8 timing events, 6 exceeding the displayed 15,000ms budget, and 5 direct `home_public_data_retry` warnings. Values included 95,120ms, 101,898ms, 108,402ms, 112,916ms and a 119,317ms retry. These are elapsed times, **not Active CPU**.
- Production CDN → Bot Name, last 12 hours around 19:34: `chatgpt-operator` 278 requests (23.4% cached), `oai-searchbot` 226 (0.9% cached), `meta-externalagent` 67 (0% cached), Semrush 29, Exa 24, Meta ads 15, Bing 11. Total CDN traffic was about 3.8K. Classification does not prove abuse or provide CPU attribution. No bots were blocked.
- Home, catalog, listing and seller pages remain dynamic to preserve the existing authenticated rendering and fresh search/ranking behavior.

Likely contributors, not quantified as month-long CPU causes: repeated SSR/Proxy work across ordinary, bot and QA traffic; speculative navigation; duplicated cache refresh work during upstream failures. A suspended background refresh/event loop could explain late timer observations, but that mechanism was not proven in live traces. Slow SQL, an AI retry storm, malicious API abuse and an infinite CPU loop were **not** established as causes of the 4-hour exhaustion.

## Supabase read-only findings

Production project `lxsvjzbiuewgwpajqrwr` is in Singapore (`ap-southeast-1`); the inspected Vercel deployment specifies `sin1`.

- At 15:21 UTC: 16 connections out of 60 configured, 1 active including the diagnostic, 0 lock waiters. This is one snapshot and cannot rule out earlier saturation.
- `pg_stat_statements` since 6 October 22:28:41 UTC: the homepage-shaped catalog query had 1,864 calls, mean 28.13ms, maximum 1,028.43ms. Another variant had 191 calls, mean 12.36ms, maximum 336.94ms. These are database execution times, not HTTP or Vercel CPU.
- A single read-only EXPLAIN ANALYZE of a related catalog projection returned 81 active rows in 13.613ms, planning 6.291ms, 219 shared-hit blocks, 0 shared reads and no disk spill. It ran with diagnostic privileges and a window count, not the exact anonymous PostgREST request; it is not an anonymous-RLS latency benchmark.
- The plan used existing category/brand indexes, memoization and the listing-image index. The small listings table used a sequential scan. No production index/schema changes are justified by this sample.
- Supabase edge logs, 14:50–15:22 UTC: 58 catalog responses, all HTTP 200, average origin time 300.24ms, maximum 1,071ms. These successful samples do not capture every cancelled client request.
- The same sample had 7 `/auth/v1/signup` HTTP 500 responses. Unified logs returned no Auth/Postgres source records for the inspected 24-hour window, so their cause is unresolved. They are an additional authentication readiness concern, not an attributed CPU cause.

No connection/query benchmark was used as a substitute for Vercel CPU. No production SQL mutation, index change, reset of statistics or stress test was performed.

## Schedulers and AI Operations

Production Supabase schedules were read, not changed:

| Job | Schedule | Successful runs in sampled 24h |
|---|---|---:|
| Listing boost reconciliation | every 15 minutes | 96 |
| Push dispatch | every 5 minutes | 288 |
| TBC recovery → `/api/internal/tbc/reconcile` | every 5 minutes | 288 |
| Brand-ad reconciliation | every 15 minutes | 96 |
| Engagement retention | daily 03:17 UTC | 1 |

The TBC route's 149 invocations in roughly 12 hours are close to its expected 144 scheduled calls. No retry storm was established. Payment recovery and push were left running.

QA project `ydocqjdjmffysexkzxyc`: the SQL shadow worker was enabled, with a 5-minute schedule and an explicit stop deadline of 19 October 06:21 UTC. At the sampled point there were 113 completed `shadow_technical` jobs, maximum attempt 1, total attempts 113, and 0 duplicate idempotency keys. The sampled last day had 111 queued/claimed/completed events each; cron job 5 had 110 successful runs. The worker executes inside Supabase; its existence is not evidence of Vercel function CPU consumption. No control flags or schedules were altered.

Deterministic triage was inspected in open, unmerged PR #125, commit `4b6a54db5b23c7592846c99f75e1ee00862c985a`, deployed to the existing AI foundation Preview. It is a pure array evaluator over at most 20 jobs/20 approvals, invoked when the admin activity page renders. It contains no model requests, database mutations, timer loop or recursive API calls. The QA reader has bounded fixed SQL and read-only transactions. This CPU branch is based on current main and deliberately does not merge #125 or the paid-provider branch.

GitHub Actions: daily SEO run at 12:37 UTC succeeded; the inspected hourly story-cleanup run at 11:41 UTC was skipped. Source configuration has an hourly bounded cleanup with at most 2 curl retries and one daily SEO run, not continuous polling. No new background scheduler was introduced.

## Implemented changes

- Query deadlines now race the request, abort the transport, reject late responses by elapsed time, clear timers and consume late promise failures. Catalog converts deadline failures into its existing explicit retry state instead of an unhandled 500.
- Homepage attempts share one 15-second deadline. Cancelled, timed-out, 4xx and rate-limited reads do not retry. A fast server failure may make one count-free attempt using only the remaining budget, capped at 6 seconds.
- Cookie-free homepage cache refreshes share one in-flight loader per instance. Failures suppress new upstream reads for 30 seconds. No successful result is stored in the guard, and no empty result is persisted. Next's existing 60-second cache and invalidation remain in charge. This is not a distributed lock across instances/regions.
- Cached homepage rows include promotion deadlines. Every render removes expired hero/VIP/banner eligibility, clears expired badges and re-sorts the bounded VIP rail by the existing tier/date rules.
- Guest non-listing Proxy requests skip SDK construction. Session cookies, dashboard auth, admin checks and listing 404 behavior remain. Listing guard reads have a 5-second deadline and do not invent a 404 on an upstream timeout.
- Seller public-count RPC uses GET only in read-only Preview; Production retains POST. Two real-SDK/guard regressions verify both transports and that Preview performs no POST. No database function/grant changes were made.
- Static asset extensions bypass Proxy. Product-card/seller and footer links disable viewport prefetch; clicks still navigate normally. This may trade a navigation round trip for reduced speculative server work.
- Branch-scoped read-only public configuration is verified before the final Preview commit is published. The existing Git deployment policy remains unchanged. An initial explicit false branch entry did not prevent an automatic build under the matching Preview wildcard; that ineffective entry was removed. The first deployment, `dpl_95U2ouoewJ7hURAP82Dzcik7Ed6m`, started before branch settings were added and is not the review target. The final read-only Preview permits login UI viewing but denies auth submissions, all mutations, admin pages, APIs and payment execution. No protection was disabled.

## Validation and comparison

Baseline: 1,050 tests passed in 186 files. Changed code: **1,075 passed in 190 files**, including 25 new functional regression cases. TypeScript passed. ESLint: 0 errors, 8 existing image warnings. Production build passed with dummy credentials; local Node was 24.19.0 whereas repository/CI target Node 22. GitHub CI is the Node 22 release check. The existing deployment policy was restored after the initial branch exclusion proved ineffective; its baseline/focused tests pass. The extra unused build is disclosed rather than counted as an optimization.

The suite includes existing auth, catalog, listing, TBC/Flitt, payment integrity, RLS and AI state-machine/database tests. These are not a substitute for authenticated browser and sandbox-provider E2E. No live purchase or registration was submitted.

| Requested metric | Before | After / evidence limit |
|---|---|---|
| Vercel Active CPU | Team 4h 1m; route table above | No representative comparison yet |
| Function invocations | Team 341,725/30d; Production about 2.4K/12h | No normalized live comparison yet |
| Function duration | Fluid duration locked; demo charts excluded | Not available |
| HTTP error rate | Production 0%, Preview 2.5% in snapshots | Not a live before/after comparison |
| DB duration | Home-shaped mean 28.13ms; sampled plan 13.613ms | No SQL/schema change; no improvement claimed |
| Deadline breaches | 6 observed timing breaches in 30-minute log snapshot | Forced deadline regression cases pass; real rate unmeasured |
| Retry count | 5 direct warning events in that log snapshot | Timeout scenario launches 1 request, no retry; not a production rate |
| Concurrent cold reads | No app-level coalescing | 20 simulated misses → 1 upstream call (95% fewer in this scenario only) |
| Failure storm | No app-level cooldown | 20 subsequent simulated calls → 0 additional reads during cooldown |
| Combined home budget | Separate 15s + 6s request budgets; inaccurate timing logs | One 15s budget, verified with delayed first/second attempts |
| LCP | 24h home/catalog field sample P75 2,849.85ms, n=7 | Insufficient matched after-sample |
| CLS | Same scope P75 0.278, n=6 | Insufficient matched after-sample |
| AI volume | 113 completed jobs at sample, max attempt 1 | Worker unchanged |

No project-wide CPU saving percentage is claimed. Expected savings come from less speculative rendering, less Proxy setup and fewer duplicate/retried public reads. Their share of the total must be measured after a separately approved release using comparable traffic windows.

## Hosting cost and recommendation

Official terms checked on 18 October 2026:

| Option | Starting hosting cost | Assessment |
|---|---:|---|
| Vercel Hobby | $0 | 4 CPU-hours included; commercial use excluded. VIP payments/advertising make it unsuitable for SamoSell's current business model even if CPU is reduced. |
| Vercel Pro | $20/month platform fee, before taxes/additional usage | Lowest migration risk. Includes one deploying seat and $20 usage credit. Additional usage is billed on demand; $20 is not an unconditional total-price cap. No upgrade or billing setting was changed. |
| Cloudflare Workers Free | $0 | 100K requests/day and 10ms CPU/invocation. Existing SSR compatibility and fit within that per-request budget are unproven; not recommended as an emergency migration. |
| Cloudflare Workers Standard | starts at $5/month, plus excess usage/other resources | Lower-cost migration candidate. Includes 10M requests and 30M CPU-ms; requires separate Next.js/runtime, caching, uploads, auth and payment compatibility verification. Current Cloudflare docs recommend vinext for Next.js 16 and document OpenNext as an alternative for compatibility gaps. No migration was performed. |

Incremental paid services enabled by this work: **none**. Existing Supabase/domain/third-party charges are outside these hosting estimates. Vercel build CPU, images and other resources must be included before projecting a Pro invoice; function CPU alone is not the whole bill.

Recommendation: do not treat Hobby as a sustainable commercial Production option. Finish verification of the patch, then explicitly choose between remaining on Vercel with an approved Pro budget or testing the lower-cost Workers migration separately. A zero-cost, compatible and terms-compliant Production replacement has not been established.

Sources:

- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage
- https://vercel.com/docs/plans/pro-plan
- https://vercel.com/docs/functions/usage-and-pricing
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/

## Production release gate

Before release: resolve the signup 500 investigation, verify authenticated catalog/listing/favorites flows and sandbox payment lifecycle on an isolated writable environment, confirm the intended AI PR separately, and obtain a comparable real CPU window. Inspect every intended team/project/commit/environment before deployment. Production merge, env/schema changes, scheduler changes, billing and migration require separate owner authorization. This audit grants no such authorization.
