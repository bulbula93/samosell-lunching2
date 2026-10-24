# SamoSell — SEO P1 URL Inspection audit

Prepared: 2026-10-11 · Property: `https://samosell.ge/` · Production stays unchanged until Preview approval.

## Status and sources
- The P0 deployment already made sitemap and catalog routes reachable.
- **Google indexing verdicts are pending.** HTTP 200 / canonical / sitemap inclusion are not equivalent to Google indexing.
- GSC Wizard API access is unavailable (expired trial). Use the free official Google Search Console URL Inspection UI or connect an alternate authorized Search Console data source. Do not infer `Indexed` from an external `site:` query.

## Inspect these representative URLs

| Priority | URL | Expected declared canonical | Reason |
|---|---|---|---|
| P0 | https://samosell.ge/ | https://samosell.ge/ | Homepage |
| P0 | https://samosell.ge/catalog | https://samosell.ge/catalog | Main second-hand clothing query |
| P0 | https://samosell.ge/catalog/women | https://samosell.ge/catalog/women | Core category |
| P0 | https://samosell.ge/catalog/men | https://samosell.ge/catalog/men | Core category |
| P0 | https://samosell.ge/catalog/kids | https://samosell.ge/catalog/kids | Core category |
| P0 | https://samosell.ge/catalog/footwear | https://samosell.ge/catalog/footwear | Core category |
| P0 | https://samosell.ge/catalog/bags | https://samosell.ge/catalog/bags | Core category |
| P0 | https://samosell.ge/catalog/vintage | https://samosell.ge/catalog/vintage | Core category |
| P0 | https://samosell.ge/catalog/accessories | https://samosell.ge/catalog/accessories | Core category |
| P0 | https://samosell.ge/catalog/perfume | https://samosell.ge/catalog/perfume | Core category |
| P1 | https://samosell.ge/sell-fast | https://samosell.ge/sell-fast | How-to-sell query |
| P1 | https://samosell.ge/where-to-sell-clothes | https://samosell.ge/where-to-sell-clothes | Where-to-sell query; **Preview only until released** |
| P1 | https://samosell.ge/vintage-georgia | https://samosell.ge/vintage-georgia | Vintage guide |
| P1 | https://samosell.ge/safety | https://samosell.ge/safety | Buyer safety guide |
| P1 | https://samosell.ge/sustainable-fashion | https://samosell.ge/sustainable-fashion | Sustainability guide |
| P1 | https://samosell.ge/listing/zara-9d595c9d | Must self-canonicalize if listing remains active | Representative listing from 2026-10-10 snapshot |
| P1 | https://samosell.ge/listing/akhali-pekhsatsmeli-d1d6ccb8 | Must self-canonicalize if listing remains active | Second representative listing |

## Record these six inspection fields for every URL
1. `Verdict / Page indexing status`: indexed, discovered/not indexed, crawled/not indexed, excluded, or URL unknown.
2. `Google-selected canonical` and `User-declared canonical`. They should agree on indexable pages; inspect unexpected variants.
3. `Last crawl` and `Crawled as` (Googlebot smartphone expected for mobile-first indexing).
4. `Page fetch / robots.txt allowed`. Investigate server errors, authentication or blocked resources.
5. `Sitemap inclusion` and whether internal links expose the URL to users and crawlers.
6. Remediation, owner and recheck date. Do not repeatedly request indexing if the URL is deliberately `noindex` or should redirect.

## How to inspect (no paid GSC Wizard plan required)
1. Open [Google Search Console](https://search.google.com/search-console) and select the verified `samosell.ge` property.
2. Paste each full URL into the top **Inspect any URL** box and wait for the Google index verdict.
3. For `URL is not on Google`, view coverage details and run **Test live URL**. Only request indexing after fixing underlying problems.
4. Export the official **Performance** metrics separately (clicks, impressions, CTR, average position) once GSC data settles; do not use Googlebot crawl tests as traffic metrics.

## Decision criteria
- P0 URLs: HTTP 200, self-canonical, index-follow, Googlebot-visible page content and stable sitemap entry.
- For `Crawled — currently not indexed`, investigate content quality, duplication and internal link depth; Google indexing is not guaranteed.
- For listing URLs: confirm currently active. Deleted/expired listings must not remain in a permanent hard-coded fallback; periodically refresh the snapshot.
- Start weekly baseline only after trusted Search Console stats become accessible.
