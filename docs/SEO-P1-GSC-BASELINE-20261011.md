# SamoSell SEO P1 — Search Console baseline & redirect audit

Date: 2026-10-11 (Asia/Tbilisi)
Property: `https://samosell.ge/`
Data source: live Windsor.ai Search Console connector `searchconsole`.
**Last complete Search Analytics date returned: 2026-10-08.** Results should not be represented as post-deployment SEO outcomes.

## Two equal 8-day comparison windows

| Metric | Sep 23–30 | Oct 1–8 | Change |
|---|---:|---:|---:|
| Organic Google clicks | 13 | 17 | +30.8% |
| Google impressions | 37 | 79 | +113.5% |
| CTR | 35.14% | 21.52% | -13.62 pp |
| Avg. position (impression-weighted) | 7.73 | 6.16 | -1.57 positions (lower is better) |

Daily rows are aggregated independently; CTR is calculated as clicks/impressions. Positions are weighted by each day's impressions, not an unweighted mean of averages. The sample size is very small; avoid interpreting the movement as a reliable trend or attributing it to 2026-10-11 deployments.

## URL visibility before the SEO deployment

Search Analytics `page` rows returned for 2026-10-01 through 2026-10-08:
- `https://samosell.ge/catalog?category=women` — 22 impressions, zero clicks
- `https://samosell.ge/catalog?category=accessories` — 13 impressions, zero clicks
- `https://samosell.ge/catalog?category=vintage` — 8 impressions, 1 click
- `https://samosell.ge/catalog?gender=women&category=shorts` — 6 impressions, zero clicks
- `https://samosell.ge/catalog` — 26 impressions, 2 clicks
- `https://samosell.ge/sell-fast` — 14 impressions, zero clicks

The page rows are grouped Google Search Analytics dimensions; totals may not equal the site-wide totals because page/query segmentation differs, and some searches are anonymized.

New canonical category URLs were not present in this pre-P0 dataset. **This does not prove non-indexation.** The changes only deployed 2026-10-11 and Search Analytics latest day is 2026-10-08.

## Production HTTP crawl, 2026-10-11

Ran read-only requests to `https://samosell.ge` with a Googlebot-like user-agent from an external temporary test runtime (not Google's actual Googlebot).

- `/sitemap.xml` — HTTP 200, XML, 113 locations.
- All eight `/catalog/{women,men,kids,footwear,bags,vintage,accessories,perfume}` — HTTP 200, self-declared canonical, `index, follow`.
- `/catalog?category=women` — 308 to `/catalog/women`.
- `/catalog?category=accessories` — 308 to `/catalog/accessories`.
- `/catalog?category=vintage` — 308 to `/catalog/vintage`.
- `/catalog?gender=women&category=shorts` — HTTP 200, `noindex, follow`, canonical `/catalog`. Nonindexable filter variant; no redirect.
- `/catalog/women?size=M` — HTTP 200, `noindex, follow`, canonical `/catalog/women`.
- Three old listing URLs from Search Analytics (`/listing/adidas`, `/listing/asos`, `/listing/geox-kalis-tkheli-sa-tbili-kurtuki-f8873147`) — HTTP 200 with self-canonicals.
- No 5xx errors in this small sample. This does not guarantee stability under load.

## Sitemap status in Search Console

Windsor.ai returned:
- path: `https://samosell.ge/sitemap.xml`
- last submitted: 2026-09-01T15:53:42Z
- last recorded downloaded: 2026-10-06T03:22:03Z
- errors: 0, warnings: 0, submitted count: 87.

**Do not interpret submitted count 87 as current indexed URLs** or conclude Google has crawled the updated 113-URL sitemap. Last recorded download predates the 2026-10-11 sitemap release.

## Indexing verification and next check

The Windsor.ai connector exposes Search Analytics and Sitemaps but not Google URL Inspection verdicts (indexed, discovered/not indexed, crawled/not indexed, Google-selected canonical). The official URL Inspection tool is required for that layer:

1. Inspect `https://samosell.ge/catalog/women`, `/catalog/men`, `/catalog/accessories`, `/catalog/vintage` and `/catalog/perfume` in the **official** [Google Search Console](https://search.google.com/search-console).
2. For each, record verdict, last crawl, declared vs Google-selected canonical and sitemap inclusion. Do not request indexing for nonindexable filter variants.
3. Recheck Search Analytics after data for Oct 11–18 become available. Track impressions of clean `/catalog/{category}` URLs against historical `?category=` URLs; don't expect immediate zero impressions for legacy URLs.
4. Track new `/where-to-sell-clothes` content **only if PR #102 is later approved and deployed**. Do not count a Preview page as Production/indexed.
5. Continue to use a weekly, equal-period comparison rather than overlapping windows; send alerts for technical errors or sustained drops, not transient tiny counts.

Status: **technical on-page readiness PASS, Google-specific indexing verdict PENDING.** No Production changes were required for this audit.
