# Public marketplace cache

The homepage now uses 60-second ISR. Its shared HTML contains public catalog data and navigation only. Profile, favorites, notification counts and personalized stories load from `/api/home-personalization` with `private, no-store` and `Vary: Cookie`. Public homepage GET/HEAD requests skip Proxy session refresh; authenticated actions and private requests retain authorization.

Listing descriptions and related public data, and seller profiles/listings/counts/reviews, use anonymous 30-second data caches. Related queries are grouped into bundles to avoid many cache lookups. Listing visibility, price, currency and promotion periods are read live before cached data is used; non-public statuses retain owner/buyer checks. Seller suspension and identity are checked live. Favorites, follows, blocks, viewer permissions and sessions stay outside shared caches.

Successful listing edits/deletes/status transitions, commerce transitions, moderation, profile updates, reviews and paid-promotion activation/reversal/reconciliation immediately expire `home-public-data`, `public-listings`, `public-sellers` and the homepage. Tags deliberately cover related pools and denormalized seller fields; this first implementation favors correctness over narrowly targeted cache keys. Ad changes also expire `active-ads`.

No database schema, migration history, secrets or service permissions are changed. Profile cache refresh uses the existing `listing_status_update` rate-limit budget, avoiding a new database allowlist entry. A failed refresh leaves the saved profile intact; public data also expires by time.

## Expiry and outages

Promotion flags are checked against their individual deadlines when cached rows are rendered. Homepage paid placements and badges additionally check expiry after hydration and when an open tab resumes, using deadline timers rather than polling. Cached HTML itself can retain the previous paid markup until regeneration/hydration; this is not a guarantee for browsers with JavaScript disabled.

ISR is stale-while-revalidate. Catalog load failure rejects regeneration so the last successful page remains available; an empty catalog fallback is not cached. External database/Edge Function writes that bypass this Next application rely on time-based revalidation. Listing detail authorization and current price/status still use the live gate. A database outage can prolong stale public content, while live-gated detail requests fail rather than bypass authorization.

## Controlled local measurement

Baseline: `4a8b873d1759342a4e9e4cefa2e0c8387abff296`. Both variants use Next 16.2.3 production servers, Node 24.19.0, the same anonymous fixture of 20 listings, three warm-up passes and 30 sequential requests per route. The personalization request is included. Build/warm-up, fixture/client CPU, browser JavaScript and images are excluded. Production currently runs Node 22, so these are process CPU measurements, not Vercel billing estimates.

| Route | CPU/request before | CPU/request after | Upstream requests before/after | Route-cache hits before/after |
| --- | ---: | ---: | ---: | ---: |
| Homepage | 71.21 ms | 14.79 ms | 0 / 0 | 0/30 / 30/30 |
| Personalization | 5.58 ms | 4.64 ms | 0 / 0 | 0/30 / 0/30 |
| Listing | 63.68 ms | 65.27 ms | 330 / 180 | 0/30 / 0/30 |
| Seller | 93.11 ms | 74.06 ms | 240 / 120 | 0/30 / 0/30 |

Total process CPU fell 32.0% for the same 120 HTTP requests. Listing CPU did not improve in this run (+2.5%); its upstream work fell 45.5%. This single warm run does not establish a production-wide or monthly saving. The initial experiment is preserved separately because it exposed seller cache overhead before grouping queries.

Reproduce with a baseline checkout and installed dependencies:

```sh
git worktree add /tmp/samosell-cache-baseline 4a8b873d1759342a4e9e4cefa2e0c8387abff296
node scripts/benchmark-public-cache.mjs --baseline /tmp/samosell-cache-baseline --output docs/performance/public-cache-benchmark.json
```

The script starts only a local fake Supabase server, builds both variants against it, measures server `process.cpuUsage()` over IPC, records `x-nextjs-cache`, and counts fixture requests. It never connects to a real database. Do not run another local production server on ports 3199, 3201 or 3202 during the measurement.

## Live verification

`live-cache-before.json` records five anonymous GETs each to the exact homepage, personalization, listing and seller URLs on the existing Production deployment: 20/20 successful responses, no CDN hits. `live-cpu-window-before.json` records the Vercel dashboard's shared five-minute window: 24 invocations, average Active CPU 113 ms, P75/P95 133 ms, no HTTP errors/timeouts. That window includes other requests and scheduled work and is not an isolated comparison. TTFB marked Demo Data was excluded.

After release, repeat the same URLs/order/count and record CDN headers and the actual Functions dashboard. HTTP request counts, origin function invocations, upstream database requests and cache hits are distinct measures. A CDN hit skips origin rendering; the private personalization request still runs, and Proxy overhead is separate. Deployment warm-up, cache age, region and traffic mix must be retained with the results. Do not infer a free-tier guarantee or production CPU percentage from the local benchmark.
